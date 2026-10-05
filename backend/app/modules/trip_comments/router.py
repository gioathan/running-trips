from fastapi import APIRouter, Depends

from app.core.dependencies import DbSession, Locale, get_current_admin, get_current_user, rate_limit
from app.core.pagination import Page, PageParams, page_params
from app.modules.audit import service as audit_service
from app.modules.trip_comments import service
from app.modules.trip_comments.schemas import (
    PendingTripCommentRead,
    TripCommentAdminRead,
    TripCommentCreate,
    TripCommentPublic,
    TripCommentRead,
)
from app.modules.users.models import User

router = APIRouter(tags=["trip-comments"])


@router.get("/users/me/pending-trip-comments", response_model=list[PendingTripCommentRead])
async def list_pending_trip_comments(db: DbSession, locale: Locale, current_user: User = Depends(get_current_user)):
    return await service.list_pending_comment_trips(db, current_user, locale)


@router.post(
    "/trip-comments",
    response_model=TripCommentRead,
    dependencies=[Depends(rate_limit("trip-comments", max_attempts=10, window_seconds=600))],
)
async def create_trip_comment(body: TripCommentCreate, db: DbSession, current_user: User = Depends(get_current_user)):
    return await service.create_comment(db, current_user, body)


@router.get("/trips/{slug}/comments", response_model=Page[TripCommentPublic])
async def list_trip_comments(slug: str, db: DbSession, params: PageParams = Depends(page_params)):
    return await service.list_trip_comments(db, slug, params)


@router.get("/admin/trip-comments", response_model=Page[TripCommentAdminRead], dependencies=[Depends(get_current_admin)])
async def list_trip_comments_admin(db: DbSession, params: PageParams = Depends(page_params)):
    return await service.list_comments_admin(db, params)


@router.delete("/admin/trip-comments/{comment_id}", status_code=204)
async def delete_trip_comment(comment_id: int, db: DbSession, current_admin: User = Depends(get_current_admin)):
    await service.delete_comment(db, comment_id)
    await audit_service.record(db, current_admin.id, "delete", "trip_comment", comment_id, {})
