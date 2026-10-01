import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError
from app.core.i18n import resolve_translation
from app.modules.bookings.models import Booking, BookingStatus
from app.modules.trip_comments.models import TripComment
from app.modules.trip_comments.schemas import PendingTripCommentRead, TripCommentCreate, TripCommentRead
from app.modules.trips.models import Trip
from app.modules.users.models import User


async def list_pending_comment_trips(db: AsyncSession, user: User, locale: str) -> list[PendingTripCommentRead]:
    today = datetime.date.today()
    commented_trip_ids = select(TripComment.trip_id).where(TripComment.user_id == user.id)
    stmt = (
        select(Trip)
        .join(Booking, Booking.trip_id == Trip.id)
        .where(
            Booking.user_id == user.id,
            Booking.status == BookingStatus.confirmed,
            Trip.end_date < today,
            Trip.id.not_in(commented_trip_ids),
        )
        .distinct()
        .order_by(Trip.end_date.desc())
    )
    trips = (await db.execute(stmt)).scalars().all()

    items = []
    for trip in trips:
        translation = resolve_translation(trip.translations, locale)
        items.append(
            PendingTripCommentRead(
                trip_id=trip.id,
                slug=trip.slug,
                title=translation.title if translation else trip.slug,
                cover_image_url=trip.cover_image_url,
                start_date=trip.start_date,
                end_date=trip.end_date,
            )
        )
    return items


async def create_comment(db: AsyncSession, user: User, body: TripCommentCreate) -> TripCommentRead:
    today = datetime.date.today()
    trip = await db.get(Trip, body.trip_id)
    if trip is None:
        raise NotFoundError("Trip not found.")
    if trip.end_date >= today:
        raise ForbiddenError("You can only comment on a trip after it has ended.")

    has_confirmed_booking = (
        await db.execute(
            select(Booking.id).where(
                Booking.user_id == user.id, Booking.trip_id == trip.id, Booking.status == BookingStatus.confirmed
            )
        )
    ).scalar_one_or_none()
    if has_confirmed_booking is None:
        raise ForbiddenError("You can only comment on trips you've booked.")

    existing = (
        await db.execute(select(TripComment.id).where(TripComment.user_id == user.id, TripComment.trip_id == trip.id))
    ).scalar_one_or_none()
    if existing is not None:
        raise ConflictError("You've already commented on this trip.")

    comment = TripComment(
        user_id=user.id, trip_id=trip.id, body=body.body, created_at=datetime.datetime.now(datetime.UTC)
    )
    db.add(comment)
    await db.commit()
    await db.refresh(comment)
    return TripCommentRead(id=comment.id, trip_id=comment.trip_id, body=comment.body, created_at=comment.created_at)
