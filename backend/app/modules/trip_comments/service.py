import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError
from app.core.i18n import resolve_translation
from app.modules.bookings.models import Booking, BookingStatus
from app.modules.trip_comments.models import TripComment
from app.core.pagination import Page, PageParams, paginate
from app.modules.trip_comments.schemas import (
    PendingTripCommentRead,
    TripCommentAdminRead,
    TripCommentCreate,
    TripCommentPublic,
    TripCommentRead,
)
from app.modules.trips.models import Trip, TripStatus
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


def _first_name(user: User) -> str:
    name = (user.full_name or "").strip()
    return name.split()[0] if name else "Runner"


async def list_trip_comments(db: AsyncSession, slug: str, params: PageParams) -> Page[TripCommentPublic]:
    trip = (
        await db.execute(select(Trip).where(Trip.slug == slug, Trip.status == TripStatus.published))
    ).scalar_one_or_none()
    if trip is None:
        raise NotFoundError("Trip not found.")
    stmt = (
        select(TripComment, User)
        .join(User, User.id == TripComment.user_id)
        .where(TripComment.trip_id == trip.id)
        .order_by(TripComment.created_at.desc())
    )
    total = await db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = (await db.execute(stmt.offset((params.page - 1) * params.page_size).limit(params.page_size))).all()
    items = [
        TripCommentPublic(id=c.id, author_name=_first_name(u), body=c.body, created_at=c.created_at) for c, u in rows
    ]
    return Page(items=items, total=total, page=params.page, page_size=params.page_size)


async def list_comments_admin(db: AsyncSession, params: PageParams) -> Page[TripCommentAdminRead]:
    rows, total = await paginate(db, select(TripComment).order_by(TripComment.created_at.desc()), params)
    items = []
    for comment in rows:
        user = await db.get(User, comment.user_id)
        trip = await db.get(Trip, comment.trip_id)
        translation = resolve_translation(trip.translations, "en")
        items.append(
            TripCommentAdminRead(
                id=comment.id,
                trip_id=trip.id,
                trip_title=translation.title if translation else trip.slug,
                user_email=user.email,
                body=comment.body,
                created_at=comment.created_at,
            )
        )
    return Page(items=items, total=total, page=params.page, page_size=params.page_size)


async def delete_comment(db: AsyncSession, comment_id: int) -> None:
    comment = await db.get(TripComment, comment_id)
    if comment is None:
        raise NotFoundError("Comment not found.")
    await db.delete(comment)
    await db.commit()
