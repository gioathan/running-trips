from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.users.models import User, UserTravelProfile
from app.modules.users.schemas import TravelProfileUpdate, UserUpdate


async def update_user(db: AsyncSession, user: User, patch: UserUpdate) -> User:
    for field, value in patch.model_dump(exclude_unset=True).items():
        if field == "locale" and value not in ("en", "el"):
            continue
        setattr(user, field, value)
    await db.commit()
    await db.refresh(user)
    return user


async def get_or_create_travel_profile(db: AsyncSession, user_id: int) -> UserTravelProfile:
    result = await db.execute(select(UserTravelProfile).where(UserTravelProfile.user_id == user_id))
    profile = result.scalar_one_or_none()
    if profile is None:
        profile = UserTravelProfile(user_id=user_id)
        db.add(profile)
        await db.commit()
        await db.refresh(profile)
    return profile


async def update_travel_profile(db: AsyncSession, user_id: int, patch: TravelProfileUpdate) -> UserTravelProfile:
    profile = await get_or_create_travel_profile(db, user_id)
    for field, value in patch.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)
    await db.commit()
    await db.refresh(profile)
    return profile
