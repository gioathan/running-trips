import asyncio
import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    ConflictError,
    ForbiddenError,
    NotFoundError,
    TripFullError,
    TripNotBookableError,
    ValidationAppError,
)
from app.core.i18n import resolve_translation
from app.core.pagination import Page, PageParams, paginate
from app.modules.bookings.models import (
    ACTIVE_BOOKING_STATUSES,
    Booking,
    BookingParticipant,
    BookingStatus,
    PaymentMethod,
)
from app.modules.bookings.schemas import (
    BookingAdminRead,
    BookingCreate,
    BookingRead,
    ParticipantRead,
    TripSummary,
)
from app.modules.payments import stripe_client
from app.modules.payments.models import Payment, PaymentStatus
from app.modules.payments.settings import (
    PaymentSettings,
    external_payment_due_at,
    external_payment_url,
    get_payment_settings,
)
from app.modules.trips.models import Trip, TripCategory, TripStatus
from app.modules.users.models import User
from app.workers.enqueue import enqueue_email

PENDING_BOOKING_TTL_MINUTES = 30
# Longer than the pending TTL: the user may be mid-way through Stripe's
# payment form (3-D Secure etc.) once a PaymentIntent exists.
AWAITING_PAYMENT_TTL_MINUTES = 60


async def count_active_participants(db: AsyncSession, trip_id: int) -> int:
    result = await db.execute(
        select(func.coalesce(func.sum(Booking.participant_count), 0)).where(
            Booking.trip_id == trip_id, Booking.status.in_(ACTIVE_BOOKING_STATUSES)
        )
    )
    return int(result.scalar_one())


def _to_trip_summary(trip: Trip, locale: str) -> TripSummary:
    translation = resolve_translation(trip.translations, locale)
    return TripSummary(
        id=trip.id,
        slug=trip.slug,
        title=translation.title if translation else trip.slug,
        cover_image_url=trip.cover_image_url,
        start_date=trip.start_date,
        end_date=trip.end_date,
        deleted=trip.deleted_at is not None,
    )


def _to_read(booking: Booking, trip: Trip, locale: str, settings: PaymentSettings) -> BookingRead:
    awaiting_external = (
        booking.payment_method == PaymentMethod.external and booking.status == BookingStatus.awaiting_payment
    )
    return BookingRead(
        id=booking.id,
        trip=_to_trip_summary(trip, locale),
        status=booking.status,
        payment_method=booking.payment_method,
        payment_url=external_payment_url(settings, trip.external_payment_url, booking.id) if awaiting_external else None,
        payment_due_at=external_payment_due_at(settings, booking.created_at) if awaiting_external else None,
        contact_email=booking.contact_email,
        contact_phone=booking.contact_phone,
        emergency_contact_name=booking.emergency_contact_name,
        emergency_contact_phone=booking.emergency_contact_phone,
        participant_count=booking.participant_count,
        total_amount_cents=booking.total_amount_cents,
        participants=[ParticipantRead.model_validate(p, from_attributes=True) for p in booking.participants],
        created_at=booking.created_at,
    )


async def create_booking(db: AsyncSession, user: User, body: BookingCreate, locale: str) -> BookingRead:
    if not body.participants:
        raise ValidationAppError("At least one participant is required.")

    # Lock the trip row for the duration of this transaction so two
    # concurrent bookings on a near-full trip can't both succeed
    # (BACKEND_PLAN.md §7) — Postgres row lock, no Redis needed.
    result = await db.execute(select(Trip).where(Trip.id == body.trip_id).with_for_update())
    trip = result.scalar_one_or_none()
    if trip is None or trip.status != TripStatus.published:
        raise NotFoundError("Trip not found.")
    if trip.start_date < datetime.date.today():
        raise TripNotBookableError("This trip has already started.")
    if trip.is_full_override:
        raise TripFullError("This trip is full.")

    trip_category = await db.get(TripCategory, body.trip_category_id)
    if trip_category is None or trip_category.trip_id != trip.id:
        raise NotFoundError("Race category not offered on this trip.")

    # A user retrying checkout (closed the modal, changed participants) would
    # otherwise leave their earlier, never-paid attempt holding seats until
    # it expires. Only `pending` ones — an `awaiting_payment` booking has a
    # live PaymentIntent and is released by the expiry job instead.
    stale = await db.execute(
        select(Booking).where(
            Booking.user_id == user.id, Booking.trip_id == trip.id, Booking.status == BookingStatus.pending
        )
    )
    for previous in stale.scalars().all():
        previous.status = BookingStatus.cancelled
    await db.flush()

    participant_count = len(body.participants)

    if trip.capacity is not None:
        active = await count_active_participants(db, trip.id)
        if active + participant_count > trip.capacity:
            raise TripFullError("This trip is full.")

    if trip_category.capacity is not None:
        result = await db.execute(
            select(func.coalesce(func.sum(Booking.participant_count), 0)).where(
                Booking.trip_category_id == trip_category.id, Booking.status.in_(ACTIVE_BOOKING_STATUSES)
            )
        )
        active_in_category = int(result.scalar_one())
        if active_in_category + participant_count > trip_category.capacity:
            raise TripFullError("This race category is full.")

    # External mode: there's no on-site payment step, so the booking goes
    # straight to awaiting_payment and holds its seats until an admin
    # confirms it or the hold period lapses (release_expired_pending_bookings).
    settings = await get_payment_settings(db)
    external = settings.mode == "external"

    booking = Booking(
        user_id=user.id,
        trip_id=trip.id,
        trip_category_id=trip_category.id,
        status=BookingStatus.awaiting_payment if external else BookingStatus.pending,
        payment_method=PaymentMethod.external if external else PaymentMethod.stripe,
        contact_email=body.contact_email.lower(),
        contact_phone=body.contact_phone,
        emergency_contact_name=body.emergency_contact_name,
        emergency_contact_phone=body.emergency_contact_phone,
        participant_count=participant_count,
        total_amount_cents=int(round(float(trip_category.price) * 100 * participant_count)),
    )
    booking.participants = [BookingParticipant(**p.model_dump()) for p in body.participants]
    db.add(booking)
    await db.commit()
    await db.refresh(booking)
    if external:
        await enqueue_email("send_external_payment_instructions_email", booking_id=booking.id)
    return _to_read(booking, trip, locale, settings)


async def _get_booking_with_trip(db: AsyncSession, booking_id: int) -> tuple[Booking, Trip]:
    booking = await db.get(Booking, booking_id)
    if booking is None:
        raise NotFoundError("Booking not found.")
    trip = await db.get(Trip, booking.trip_id)
    return booking, trip


async def get_booking(db: AsyncSession, booking_id: int, user: User, locale: str) -> BookingRead:
    booking, trip = await _get_booking_with_trip(db, booking_id)
    if booking.user_id != user.id and user.role != "admin":
        raise ForbiddenError("You don't have access to this booking.")
    return _to_read(booking, trip, locale, await get_payment_settings(db))


async def list_user_bookings(
    db: AsyncSession, user_id: int, status_filter: str | None, locale: str, params: PageParams
) -> Page[BookingRead]:
    stmt = select(Booking).where(Booking.user_id == user_id).join(Trip, Trip.id == Booking.trip_id)
    today = datetime.date.today()
    if status_filter == "upcoming":
        stmt = stmt.where(Trip.end_date >= today)
    elif status_filter == "past":
        stmt = stmt.where(Trip.end_date < today)
    stmt = stmt.order_by(Trip.start_date.desc())

    bookings, total = await paginate(db, stmt, params)
    settings = await get_payment_settings(db)
    items = []
    for booking in bookings:
        trip = await db.get(Trip, booking.trip_id)
        items.append(_to_read(booking, trip, locale, settings))
    return Page(items=items, total=total, page=params.page, page_size=params.page_size)


async def list_bookings_admin(db: AsyncSession, status_filter: str | None, params: PageParams) -> Page[BookingAdminRead]:
    stmt = select(Booking).order_by(Booking.created_at.desc())
    if status_filter:
        stmt = stmt.where(Booking.status == BookingStatus(status_filter))
    bookings, total = await paginate(db, stmt, params)
    settings = await get_payment_settings(db)

    items = []
    for booking in bookings:
        trip = await db.get(Trip, booking.trip_id)
        user = await db.get(User, booking.user_id)
        base = _to_read(booking, trip, "en", settings)
        items.append(BookingAdminRead(**base.model_dump(), user_id=booking.user_id, user_email=user.email))
    return Page(items=items, total=total, page=params.page, page_size=params.page_size)


async def update_booking_status_admin(db: AsyncSession, booking_id: int, new_status: str) -> BookingAdminRead:
    booking, trip = await _get_booking_with_trip(db, booking_id)
    try:
        status = BookingStatus(new_status)
    except ValueError as exc:
        raise ConflictError(f"Invalid booking status: {new_status}") from exc
    if (
        status == BookingStatus.refunded
        and booking.status != BookingStatus.refunded
        and booking.payment_method == PaymentMethod.stripe
    ):
        # For a Stripe booking "refunded" has to mean money went back — that
        # happens through POST /admin/payments/{id}/refund, which sets this
        # status itself. External bookings are refunded outside this system,
        # so the admin records it by hand.
        raise ConflictError("Refund the payment from the Payments screen; that marks the booking refunded.")
    newly_confirmed = status == BookingStatus.confirmed and booking.status != BookingStatus.confirmed
    booking.status = status
    await db.commit()
    await db.refresh(booking)
    if newly_confirmed:
        # The Stripe webhook sends this for on-site payments; a manual
        # confirmation (external payment reported, comped seat) is the
        # equivalent moment for everything else.
        await enqueue_email("send_booking_confirmation_email", booking_id=booking.id)
    user = await db.get(User, booking.user_id)
    base = _to_read(booking, trip, "en", await get_payment_settings(db))
    return BookingAdminRead(**base.model_dump(), user_id=booking.user_id, user_email=user.email)


async def _cancel_unpaid_stripe_booking(db: AsyncSession, booking: Booking) -> bool:
    """Cancel an awaiting_payment Stripe booking, PaymentIntent first so a
    late payment can't land on it. Returns False (booking untouched) if
    Stripe refuses because the payment already went through or is processing."""
    payments = (
        await db.execute(
            select(Payment).where(Payment.booking_id == booking.id, Payment.status == PaymentStatus.requires_payment)
        )
    ).scalars().all()
    cancelled = [await asyncio.to_thread(stripe_client.cancel_payment_intent, p.provider_ref) for p in payments]
    if not all(cancelled):
        return False
    for payment in payments:
        payment.status = PaymentStatus.failed
    booking.status = BookingStatus.cancelled
    return True


async def cancel_unpaid_bookings_for_trip(db: AsyncSession, trip_id: int) -> int:
    """Used when a trip is deleted: nobody should be able to pay for it any
    more. Paid (confirmed) bookings are deliberately left alone. Does not
    commit. Returns how many bookings were cancelled."""
    result = await db.execute(
        select(Booking).where(
            Booking.trip_id == trip_id,
            Booking.status.in_((BookingStatus.pending, BookingStatus.awaiting_payment)),
        )
    )
    cancelled = 0
    for booking in result.scalars().all():
        if booking.status == BookingStatus.awaiting_payment and booking.payment_method == PaymentMethod.stripe:
            if not await _cancel_unpaid_stripe_booking(db, booking):
                continue  # payment is going through — the webhook will confirm it
        else:
            booking.status = BookingStatus.cancelled
        cancelled += 1
    return cancelled


async def release_expired_pending_bookings(db: AsyncSession) -> int:
    """Frees seats held by abandoned checkouts — run periodically by the
    ARQ worker (BACKEND_PLAN.md §8). Covers `pending` (never reached
    payment), Stripe `awaiting_payment` (PaymentIntent created, never paid),
    and external-payment bookings nobody confirmed within the hold period.
    For the latter the PaymentIntent is cancelled on Stripe first, so a late
    payment can't land on a booking whose seat was already given away; if
    Stripe refuses (already paid/processing) the booking is left for the
    webhook to confirm."""
    now = datetime.datetime.now(datetime.UTC)
    released = 0

    pending_cutoff = now - datetime.timedelta(minutes=PENDING_BOOKING_TTL_MINUTES)
    result = await db.execute(
        select(Booking).where(Booking.status == BookingStatus.pending, Booking.created_at < pending_cutoff)
    )
    for booking in result.scalars().all():
        booking.status = BookingStatus.cancelled
        released += 1

    awaiting_cutoff = now - datetime.timedelta(minutes=AWAITING_PAYMENT_TTL_MINUTES)
    result = await db.execute(
        select(Booking).where(
            Booking.status == BookingStatus.awaiting_payment,
            Booking.payment_method == PaymentMethod.stripe,
            Booking.updated_at < awaiting_cutoff,
        )
    )
    for booking in result.scalars().all():
        if await _cancel_unpaid_stripe_booking(db, booking):
            released += 1

    # External-payment bookings: paid off-site and confirmed by an admin, so
    # the hold is days, not minutes (admin-configured). Measured from
    # creation — the deadline the customer was told.
    settings = await get_payment_settings(db)
    external_cutoff = now - datetime.timedelta(days=settings.external_hold_days)
    result = await db.execute(
        select(Booking).where(
            Booking.status == BookingStatus.awaiting_payment,
            Booking.payment_method == PaymentMethod.external,
            Booking.created_at < external_cutoff,
        )
    )
    for booking in result.scalars().all():
        booking.status = BookingStatus.cancelled
        released += 1

    await db.commit()
    return released
