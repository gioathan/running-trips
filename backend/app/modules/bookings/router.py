from fastapi import APIRouter, Depends, Query

from app.core.dependencies import DbSession, Locale, get_current_admin, get_current_user
from app.core.pagination import Page, PageParams, page_params
from app.modules.audit import service as audit_service
from app.modules.bookings import service
from app.modules.bookings.schemas import BookingAdminRead, BookingCreate, BookingRead, BookingStatusUpdate
from app.modules.users.models import User

router = APIRouter(tags=["bookings"])


@router.post("/bookings", response_model=BookingRead)
async def create_booking(
    body: BookingCreate, db: DbSession, locale: Locale, current_user: User = Depends(get_current_user)
):
    return await service.create_booking(db, current_user, body, locale)


@router.get("/bookings/{booking_id}", response_model=BookingRead)
async def get_booking(
    booking_id: int, db: DbSession, locale: Locale, current_user: User = Depends(get_current_user)
):
    return await service.get_booking(db, booking_id, current_user, locale)


@router.get("/users/me/bookings", response_model=Page[BookingRead])
async def list_my_bookings(
    db: DbSession,
    locale: Locale,
    current_user: User = Depends(get_current_user),
    params: PageParams = Depends(page_params),
    status: str | None = Query(None, pattern="^(upcoming|past)$"),
):
    return await service.list_user_bookings(db, current_user.id, status, locale, params)


@router.get("/admin/bookings", response_model=Page[BookingAdminRead], dependencies=[Depends(get_current_admin)])
async def list_bookings_admin(db: DbSession, params: PageParams = Depends(page_params), status: str | None = None):
    return await service.list_bookings_admin(db, status, params)


@router.patch("/admin/bookings/{booking_id}", response_model=BookingAdminRead)
async def update_booking_admin(
    booking_id: int, body: BookingStatusUpdate, db: DbSession, current_admin: User = Depends(get_current_admin)
):
    booking = await service.update_booking_status_admin(db, booking_id, body.status)
    await audit_service.record(db, current_admin.id, "update", "booking", booking_id, {"status": body.status})
    return booking
