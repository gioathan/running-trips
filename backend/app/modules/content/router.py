from fastapi import APIRouter, Depends

from app.core.dependencies import DbSession, Locale, get_current_admin
from app.modules.audit import service as audit_service
from app.modules.content import service
from app.modules.content.schemas import PageAdminRead, PageRead, PageUpdate, SiteSettingsUpdate
from app.modules.users.models import User

router = APIRouter(tags=["content"])


@router.get("/content/pages/{slug}", response_model=PageRead)
async def get_page(slug: str, db: DbSession, locale: Locale):
    return await service.get_page(db, slug, locale)


@router.get("/admin/content/pages/{slug}", response_model=PageAdminRead, dependencies=[Depends(get_current_admin)])
async def get_page_admin(slug: str, db: DbSession):
    return await service.get_page_admin(db, slug)


@router.patch("/admin/content/pages/{slug}", response_model=PageAdminRead)
async def update_page(slug: str, body: PageUpdate, db: DbSession, current_admin: User = Depends(get_current_admin)):
    page = await service.update_page(db, slug, body)
    await audit_service.record(db, current_admin.id, "update", "page", slug, {"section_count": len(body.sections)})
    return page


@router.get("/admin/site-settings", dependencies=[Depends(get_current_admin)])
async def get_site_settings(db: DbSession):
    return await service.list_site_settings(db)


@router.patch("/admin/site-settings")
async def update_site_settings(body: SiteSettingsUpdate, db: DbSession, current_admin: User = Depends(get_current_admin)):
    settings = await service.update_site_settings(db, body.settings)
    await audit_service.record(db, current_admin.id, "update", "site_settings", ",".join(body.settings.keys()), {})
    return settings
