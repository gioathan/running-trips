import datetime
import logging

import stripe
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    ConflictError,
    ForbiddenError,
    NotFoundError,
    ServiceNotConfiguredError,
    UnauthorizedError,
    ValidationAppError,
)
from app.core.redis import get_redis
from app.modules.bookings.models import Booking, BookingStatus
from app.modules.payments import stripe_client
from app.modules.payments.models import Payment, PaymentStatus
from app.core.config import get_settings
from app.core.i18n import resolve_translation
from app.core.pagination import Page, PageParams, paginate
from app.modules.payments.schemas import CreateIntentResponse, PaymentAdminRead, PaymentRead
from app.modules.trips.models import Trip
from app.modules.users.models import User
from app.workers.enqueue import enqueue_email

WEBHOOK_DEDUPE_TTL_SECONDS = 60 * 60 * 24 * 7

logger = logging.getLogger(__name__)


async def create_intent(db: AsyncSession, user: User, booking_id: int) -> CreateIntentResponse:
    booking = await db.get(Booking, booking_id)
    if booking is None:
        raise NotFoundError("Booking not found.")
    if booking.user_id != user.id:
        raise ForbiddenError("You don't have access to this booking.")
    if booking.status not in (BookingStatus.pending, BookingStatus.awaiting_payment):
        raise ConflictError(f"Booking is already {booking.status}.")
    if not get_settings().stripe_secret_key:
        raise ServiceNotConfiguredError("Payments are not configured (STRIPE_SECRET_KEY is unset).")

    # Reuse an existing not-yet-paid PaymentIntent for this booking instead
    # of creating a duplicate one on retry/refresh.
    result = await db.execute(
        select(Payment).where(Payment.booking_id == booking_id, Payment.status == PaymentStatus.requires_payment)
    )
    existing = result.scalar_one_or_none()
    if existing:
        intent = stripe.PaymentIntent.retrieve(existing.provider_ref)
        return CreateIntentResponse(
            payment_id=existing.id, client_secret=intent.client_secret, amount_cents=existing.amount_cents
        )

    intent = stripe_client.create_payment_intent(booking.total_amount_cents, metadata={"booking_id": str(booking.id)})
    payment = Payment(
        booking_id=booking.id,
        provider_ref=intent.id,
        amount_cents=booking.total_amount_cents,
        status=PaymentStatus.requires_payment,
        created_at=datetime.datetime.now(datetime.UTC),
    )
    booking.status = BookingStatus.awaiting_payment
    db.add(payment)
    await db.commit()
    await db.refresh(payment)
    return CreateIntentResponse(payment_id=payment.id, client_secret=intent.client_secret, amount_cents=payment.amount_cents)


async def get_payment(db: AsyncSession, payment_id: int, user: User) -> PaymentRead:
    payment = await db.get(Payment, payment_id)
    if payment is None:
        raise NotFoundError("Payment not found.")
    booking = await db.get(Booking, payment.booking_id)
    if booking.user_id != user.id and user.role != "admin":
        raise ForbiddenError("You don't have access to this payment.")
    return PaymentRead(
        id=payment.id, booking_id=payment.booking_id, provider=payment.provider, status=payment.status, amount_cents=payment.amount_cents
    )


async def handle_webhook(db: AsyncSession, payload: bytes, sig_header: str) -> None:
    try:
        event = stripe_client.construct_webhook_event(payload, sig_header)
    except (ValueError, stripe.StripeError) as exc:
        # stripe.StripeError (rather than the more specific
        # SignatureVerificationError) is the stable top-level symbol across
        # stripe-python versions — covers both a malformed payload and a bad signature.
        raise UnauthorizedError("Invalid Stripe webhook signature.") from exc

    redis = get_redis()
    dedupe_key = f"stripe-event:{event['id']}"
    if await redis.exists(dedupe_key):
        return  # Already processed this event — webhook retries are expected.

    if event["type"] in ("payment_intent.succeeded", "payment_intent.payment_failed"):
        await _apply_intent_event(db, event["type"], event["data"]["object"])

    # Marked processed only after the DB work committed: if anything above
    # raised, Stripe gets a 5xx and its retry is processed normally instead
    # of being swallowed by a dedupe key set too early. The handler is
    # idempotent anyway (status transitions are guarded), so a duplicate
    # delivery racing this line is harmless.
    await redis.set(dedupe_key, "1", ex=WEBHOOK_DEDUPE_TTL_SECONDS)


async def _apply_intent_event(db: AsyncSession, event_type: str, intent: dict) -> None:
    result = await db.execute(select(Payment).where(Payment.provider_ref == intent["id"]).with_for_update())
    payment = result.scalar_one_or_none()
    if payment is None:
        return

    payment.raw_payload = intent

    if event_type == "payment_intent.payment_failed":
        if payment.status == PaymentStatus.requires_payment:
            payment.status = PaymentStatus.failed
        await db.commit()
        return

    payment.status = PaymentStatus.succeeded
    result = await db.execute(select(Booking).where(Booking.id == payment.booking_id).with_for_update())
    booking = result.scalar_one()
    newly_confirmed = booking.status in (BookingStatus.pending, BookingStatus.awaiting_payment)
    if newly_confirmed:
        booking.status = BookingStatus.confirmed
    elif booking.status != BookingStatus.confirmed:
        # Paid for a booking that was cancelled/refunded in the meantime —
        # don't silently resurrect it (its seat may be gone). The payment row
        # is marked succeeded so it shows up for an admin to refund.
        logger.warning(
            "Payment %s succeeded for booking %s in status %s — needs manual review/refund.",
            payment.id,
            booking.id,
            booking.status,
        )
    await db.commit()

    if newly_confirmed:
        await enqueue_email("send_booking_confirmation_email", booking_id=booking.id)


async def _to_admin_read(db: AsyncSession, payment: Payment) -> PaymentAdminRead:
    booking = await db.get(Booking, payment.booking_id)
    user = await db.get(User, booking.user_id)
    trip = await db.get(Trip, booking.trip_id)
    translation = resolve_translation(trip.translations, "en")
    return PaymentAdminRead(
        id=payment.id,
        booking_id=booking.id,
        booking_status=booking.status,
        user_email=user.email,
        trip_title=translation.title if translation else trip.slug,
        provider=payment.provider,
        provider_ref=payment.provider_ref,
        status=payment.status,
        amount_cents=payment.amount_cents,
        created_at=payment.created_at,
    )


async def list_payments_admin(db: AsyncSession, status_filter: str | None, params: PageParams) -> Page[PaymentAdminRead]:
    stmt = select(Payment).order_by(Payment.created_at.desc())
    if status_filter:
        try:
            stmt = stmt.where(Payment.status == PaymentStatus(status_filter))
        except ValueError as exc:
            raise ValidationAppError(f"Unknown payment status: {status_filter}") from exc
    rows, total = await paginate(db, stmt, params)
    items = [await _to_admin_read(db, p) for p in rows]
    return Page(items=items, total=total, page=params.page, page_size=params.page_size)


async def refund_payment(db: AsyncSession, payment_id: int) -> PaymentAdminRead:
    """Full refund through Stripe, then marks the payment and its booking
    refunded (which also frees the booking's seats — refunded isn't an
    active booking status)."""
    result = await db.execute(select(Payment).where(Payment.id == payment_id).with_for_update())
    payment = result.scalar_one_or_none()
    if payment is None:
        raise NotFoundError("Payment not found.")
    if payment.status != PaymentStatus.succeeded:
        raise ConflictError(f"Only succeeded payments can be refunded (this one is {payment.status}).")
    if not get_settings().stripe_secret_key:
        raise ServiceNotConfiguredError("Payments are not configured (STRIPE_SECRET_KEY is unset).")
    try:
        stripe_client.refund_payment_intent(payment.provider_ref)
    except stripe.StripeError as exc:
        raise ConflictError(f"Stripe refused the refund: {exc.user_message or exc}") from exc

    payment.status = PaymentStatus.refunded
    booking = await db.get(Booking, payment.booking_id)
    booking.status = BookingStatus.refunded
    await db.commit()
    return await _to_admin_read(db, payment)
