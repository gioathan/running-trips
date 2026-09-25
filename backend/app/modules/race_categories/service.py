from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError
from app.core.i18n import resolve_translation
from app.modules.race_categories.models import RaceCategory, RaceCategoryTranslation
from app.modules.race_categories.schemas import (
    RaceCategoryAdminRead,
    RaceCategoryCreate,
    RaceCategoryRead,
    RaceCategoryUpdate,
)


async def list_categories(db: AsyncSession, locale: str) -> list[RaceCategoryRead]:
    result = await db.execute(select(RaceCategory))
    categories = result.scalars().unique().all()
    out = []
    for c in categories:
        translation = resolve_translation(c.translations, locale)
        out.append(RaceCategoryRead(id=c.id, slug=c.slug, name=translation.name if translation else c.slug))
    return out


async def get_category_or_404(db: AsyncSession, category_id: int) -> RaceCategory:
    category = await db.get(RaceCategory, category_id)
    if category is None:
        raise NotFoundError("Race category not found.")
    return category


def _to_admin_read(category: RaceCategory) -> RaceCategoryAdminRead:
    return RaceCategoryAdminRead(
        id=category.id, slug=category.slug, translations={t.locale: t.name for t in category.translations}
    )


async def create_category(db: AsyncSession, body: RaceCategoryCreate) -> RaceCategoryAdminRead:
    existing = await db.execute(select(RaceCategory).where(RaceCategory.slug == body.slug))
    if existing.scalar_one_or_none():
        raise ConflictError("A race category with this slug already exists.")

    category = RaceCategory(slug=body.slug)
    category.translations = [
        RaceCategoryTranslation(locale=t.locale, name=t.name) for t in body.translations
    ]
    db.add(category)
    await db.commit()
    await db.refresh(category)
    return _to_admin_read(category)


async def update_category(db: AsyncSession, category_id: int, body: RaceCategoryUpdate) -> RaceCategoryAdminRead:
    category = await get_category_or_404(db, category_id)
    if body.slug is not None:
        category.slug = body.slug
    if body.translations is not None:
        by_locale = {t.locale: t for t in category.translations}
        for incoming in body.translations:
            if incoming.locale in by_locale:
                by_locale[incoming.locale].name = incoming.name
            else:
                category.translations.append(RaceCategoryTranslation(locale=incoming.locale, name=incoming.name))
    await db.commit()
    await db.refresh(category)
    return _to_admin_read(category)


async def delete_category(db: AsyncSession, category_id: int) -> None:
    category = await get_category_or_404(db, category_id)
    await db.delete(category)
    await db.commit()
