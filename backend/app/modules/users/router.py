from fastapi import APIRouter, Depends

from app.core.dependencies import DbSession, get_current_user
from app.modules.users import service
from app.modules.users.models import User
from app.modules.users.schemas import TravelProfileRead, TravelProfileUpdate, UserRead, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserRead)
async def get_me(current_user: User = Depends(get_current_user)):
    return UserRead.model_validate(current_user)


@router.patch("/me", response_model=UserRead)
async def patch_me(body: UserUpdate, db: DbSession, current_user: User = Depends(get_current_user)):
    user = await service.update_user(db, current_user, body)
    return UserRead.model_validate(user)


@router.get("/me/travel-profile", response_model=TravelProfileRead)
async def get_travel_profile(db: DbSession, current_user: User = Depends(get_current_user)):
    profile = await service.get_or_create_travel_profile(db, current_user.id)
    return TravelProfileRead.model_validate(profile)


@router.patch("/me/travel-profile", response_model=TravelProfileRead)
async def patch_travel_profile(
    body: TravelProfileUpdate, db: DbSession, current_user: User = Depends(get_current_user)
):
    profile = await service.update_travel_profile(db, current_user.id, body)
    return TravelProfileRead.model_validate(profile)
