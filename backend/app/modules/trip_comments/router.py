from fastapi import APIRouter, Depends

from app.core.dependencies import DbSession, Locale, get_current_user
from app.modules.trip_comments import service
from app.modules.trip_comments.schemas import PendingTripCommentRead, TripCommentCreate, TripCommentRead
from app.modules.users.models import User

router = APIRouter(tags=["trip-comments"])


@router.get("/users/me/pending-trip-comments", response_model=list[PendingTripCommentRead])
async def list_pending_trip_comments(db: DbSession, locale: Locale, current_user: User = Depends(get_current_user)):
    return await service.list_pending_comment_trips(db, current_user, locale)


@router.post("/trip-comments", response_model=TripCommentRead)
async def create_trip_comment(body: TripCommentCreate, db: DbSession, current_user: User = Depends(get_current_user)):
    return await service.create_comment(db, current_user, body)
