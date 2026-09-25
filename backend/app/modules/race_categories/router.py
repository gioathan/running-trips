from fastapi import APIRouter, Depends

from app.core.dependencies import DbSession, Locale, get_current_admin
from app.modules.race_categories import service
from app.modules.race_categories.schemas import (
    RaceCategoryAdminRead,
    RaceCategoryCreate,
    RaceCategoryRead,
    RaceCategoryUpdate,
)

router = APIRouter(tags=["race-categories"])


@router.get("/race-categories", response_model=list[RaceCategoryRead])
async def list_race_categories(db: DbSession, locale: Locale):
    return await service.list_categories(db, locale)


@router.post("/admin/race-categories", response_model=RaceCategoryAdminRead, dependencies=[Depends(get_current_admin)])
async def create_race_category(body: RaceCategoryCreate, db: DbSession):
    return await service.create_category(db, body)


@router.patch(
    "/admin/race-categories/{category_id}",
    response_model=RaceCategoryAdminRead,
    dependencies=[Depends(get_current_admin)],
)
async def update_race_category(category_id: int, body: RaceCategoryUpdate, db: DbSession):
    return await service.update_category(db, category_id, body)


@router.delete("/admin/race-categories/{category_id}", status_code=204, dependencies=[Depends(get_current_admin)])
async def delete_race_category(category_id: int, db: DbSession):
    await service.delete_category(db, category_id)
