from fastapi import APIRouter, Depends

from app.core.dependencies import DbSession, Locale, get_current_admin
from app.modules.audit import service as audit_service
from app.modules.race_categories import service
from app.modules.race_categories.schemas import (
    RaceCategoryAdminRead,
    RaceCategoryCreate,
    RaceCategoryRead,
    RaceCategoryUpdate,
)
from app.modules.users.models import User

router = APIRouter(tags=["race-categories"])


@router.get("/race-categories", response_model=list[RaceCategoryRead])
async def list_race_categories(db: DbSession, locale: Locale):
    return await service.list_categories(db, locale)


@router.get(
    "/admin/race-categories",
    response_model=list[RaceCategoryAdminRead],
    dependencies=[Depends(get_current_admin)],
)
async def list_admin_race_categories(db: DbSession):
    return await service.list_admin_categories(db)


@router.post("/admin/race-categories", response_model=RaceCategoryAdminRead)
async def create_race_category(body: RaceCategoryCreate, db: DbSession, current_admin: User = Depends(get_current_admin)):
    category = await service.create_category(db, body)
    await audit_service.record(db, current_admin.id, "create", "race_category", category.id, body.model_dump(mode="json"))
    return category


@router.patch("/admin/race-categories/{category_id}", response_model=RaceCategoryAdminRead)
async def update_race_category(
    category_id: int, body: RaceCategoryUpdate, db: DbSession, current_admin: User = Depends(get_current_admin)
):
    category = await service.update_category(db, category_id, body)
    await audit_service.record(
        db, current_admin.id, "update", "race_category", category_id, body.model_dump(mode="json", exclude_unset=True)
    )
    return category


@router.delete("/admin/race-categories/{category_id}", status_code=204)
async def delete_race_category(category_id: int, db: DbSession, current_admin: User = Depends(get_current_admin)):
    await service.delete_category(db, category_id)
    await audit_service.record(db, current_admin.id, "delete", "race_category", category_id, {})
