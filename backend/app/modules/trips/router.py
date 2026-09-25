from fastapi import APIRouter, Depends, Query

from app.core.dependencies import DbSession, Locale, get_current_admin
from app.core.pagination import Page, PageParams, page_params
from app.modules.audit import service as audit_service
from app.modules.trips import service
from app.modules.trips.schemas import (
    TripAdminRead,
    TripCreate,
    TripDetail,
    TripImageIn,
    TripInclusionIn,
    TripListItem,
    TripUpdate,
)
from app.modules.users.models import User

router = APIRouter(tags=["trips"])


@router.get("/trips", response_model=Page[TripListItem])
async def list_trips(
    db: DbSession,
    locale: Locale,
    params: PageParams = Depends(page_params),
    status: str | None = Query(None, pattern="^(upcoming|past)$"),
    category: str | None = None,
    q: str | None = None,
    featured: bool = False,
):
    return await service.list_trips(db, locale, status, category, q, featured, params)


@router.get("/trips/{slug}", response_model=TripDetail)
async def get_trip(slug: str, db: DbSession, locale: Locale):
    return await service.get_trip_by_slug(db, slug, locale)


@router.get("/admin/trips", response_model=Page[TripAdminRead], dependencies=[Depends(get_current_admin)])
async def list_trips_admin(db: DbSession, params: PageParams = Depends(page_params)):
    return await service.list_trips_admin(db, params)


@router.get("/admin/trips/{trip_id}", response_model=TripAdminRead, dependencies=[Depends(get_current_admin)])
async def get_trip_admin(trip_id: int, db: DbSession):
    return await service.get_trip_admin(db, trip_id)


@router.post("/admin/trips", response_model=TripAdminRead)
async def create_trip(body: TripCreate, db: DbSession, current_admin: User = Depends(get_current_admin)):
    trip = await service.create_trip(db, body)
    await audit_service.record(db, current_admin.id, "create", "trip", trip.id, body.model_dump(mode="json"))
    return trip


@router.patch("/admin/trips/{trip_id}", response_model=TripAdminRead)
async def update_trip(trip_id: int, body: TripUpdate, db: DbSession, current_admin: User = Depends(get_current_admin)):
    trip = await service.update_trip(db, trip_id, body)
    await audit_service.record(db, current_admin.id, "update", "trip", trip_id, body.model_dump(mode="json", exclude_unset=True))
    return trip


@router.delete("/admin/trips/{trip_id}", status_code=204)
async def delete_trip(trip_id: int, db: DbSession, current_admin: User = Depends(get_current_admin)):
    await service.delete_trip(db, trip_id)
    await audit_service.record(db, current_admin.id, "delete", "trip", trip_id, {})


@router.post("/admin/trips/{trip_id}/images", dependencies=[Depends(get_current_admin)])
async def add_trip_image(trip_id: int, body: TripImageIn, db: DbSession):
    return await service.add_image(db, trip_id, body)


@router.delete("/admin/trips/{trip_id}/images/{image_id}", status_code=204, dependencies=[Depends(get_current_admin)])
async def delete_trip_image(trip_id: int, image_id: int, db: DbSession):
    await service.delete_image(db, trip_id, image_id)


@router.post("/admin/trips/{trip_id}/inclusions", dependencies=[Depends(get_current_admin)])
async def add_trip_inclusion(trip_id: int, body: TripInclusionIn, db: DbSession):
    return await service.add_inclusion(db, trip_id, body)


@router.patch("/admin/trips/{trip_id}/inclusions/{inclusion_id}", dependencies=[Depends(get_current_admin)])
async def update_trip_inclusion(trip_id: int, inclusion_id: int, body: TripInclusionIn, db: DbSession):
    return await service.update_inclusion(db, trip_id, inclusion_id, body)


@router.delete(
    "/admin/trips/{trip_id}/inclusions/{inclusion_id}", status_code=204, dependencies=[Depends(get_current_admin)]
)
async def delete_trip_inclusion(trip_id: int, inclusion_id: int, db: DbSession):
    await service.delete_inclusion(db, trip_id, inclusion_id)
