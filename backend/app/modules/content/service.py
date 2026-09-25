from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.core.i18n import resolve_translation
from app.modules.content.models import ContentSection, ContentSectionTranslation, Page, SiteSetting
from app.modules.content.schemas import (
    PageAdminRead,
    PageRead,
    PageUpdate,
    SectionAdminRead,
    SectionRead,
)


async def get_page(db: AsyncSession, slug: str, locale: str) -> PageRead:
    result = await db.execute(select(Page).where(Page.slug == slug))
    page = result.scalar_one_or_none()
    if page is None:
        raise NotFoundError("Page not found.")

    sections = []
    for section in page.sections:
        translation = resolve_translation(section.translations, locale)
        sections.append(
            SectionRead(id=section.id, type=section.type, sort_order=section.sort_order, data=translation.data if translation else {})
        )
    return PageRead(slug=page.slug, sections=sections)


async def _get_or_create_page(db: AsyncSession, slug: str) -> Page:
    result = await db.execute(select(Page).where(Page.slug == slug))
    page = result.scalar_one_or_none()
    if page is None:
        page = Page(slug=slug)
        db.add(page)
        await db.flush()
    return page


def _to_admin_read(page: Page) -> PageAdminRead:
    sections = [
        SectionAdminRead(
            id=s.id, type=s.type, sort_order=s.sort_order, translations={t.locale: t.data for t in s.translations}
        )
        for s in page.sections
    ]
    return PageAdminRead(slug=page.slug, sections=sections)


async def get_page_admin(db: AsyncSession, slug: str) -> PageAdminRead:
    page = await _get_or_create_page(db, slug)
    await db.commit()
    return _to_admin_read(page)


async def update_page(db: AsyncSession, slug: str, body: PageUpdate) -> PageAdminRead:
    """Full-replace semantics on the section list: sections omitted from
    the payload are deleted, ones with an id are updated in place, ones
    without an id are created — one save button covers add/reorder/
    remove/edit for both locales at once (BACKEND_PLAN.md §5)."""
    page = await _get_or_create_page(db, slug)

    incoming_ids = {s.id for s in body.sections if s.id is not None}
    for existing in list(page.sections):
        if existing.id not in incoming_ids:
            page.sections.remove(existing)

    by_id = {s.id: s for s in page.sections}
    for position, incoming in enumerate(body.sections):
        if incoming.id is not None and incoming.id in by_id:
            section = by_id[incoming.id]
            section.type = incoming.type
            section.sort_order = position
            by_locale = {t.locale: t for t in section.translations}
            for translation_in in incoming.translations:
                if translation_in.locale in by_locale:
                    by_locale[translation_in.locale].data = translation_in.data
                else:
                    section.translations.append(
                        ContentSectionTranslation(locale=translation_in.locale, data=translation_in.data)
                    )
        else:
            section = ContentSection(page_id=page.id, type=incoming.type, sort_order=position)
            section.translations = [
                ContentSectionTranslation(locale=t.locale, data=t.data) for t in incoming.translations
            ]
            page.sections.append(section)

    await db.commit()
    await db.refresh(page)
    return _to_admin_read(page)


async def list_site_settings(db: AsyncSession) -> dict[str, dict]:
    result = await db.execute(select(SiteSetting))
    return {row.key: row.value for row in result.scalars().all()}


async def update_site_settings(db: AsyncSession, settings: dict[str, dict]) -> dict[str, dict]:
    for key, value in settings.items():
        setting = await db.get(SiteSetting, key)
        if setting is None:
            db.add(SiteSetting(key=key, value=value))
        else:
            setting.value = value
    await db.commit()
    return await list_site_settings(db)
