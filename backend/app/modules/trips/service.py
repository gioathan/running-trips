from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError
from app.core.i18n import resolve_translation
from app.core.pagination import Page, PageParams, paginate
from app.modules.race_categories.schemas import RaceCategoryRead
from app.modules.trips import repository
from app.modules.trips.models import Trip, TripCategory, TripImage, TripInclusion, TripInclusionTranslation, TripStatus, TripTranslation
from app.modules.trips.schemas import (
    TranslationIn,
    TripAdminRead,
    TripCategoryRead,
    TripCreate,
    TripDetail,
    TripImageIn,
    TripInclusionIn,
    TripListItem,
    TripUpdate,
)


def _duration_label(trip: Trip, override: str | None) -> str:
    if override:
        return override
    days = (trip.end_date - trip.start_date).days + 1
    return f"{days} DAY" if days == 1 else f"{days} DAYS"


async def _confirmed_participant_count(db: AsyncSession, trip_id: int) -> int:
    # Deferred to the bookings module (built alongside this one) to avoid a
    # circular import at module load time — see BookingService.count_confirmed_participants.
    from app.modules.bookings.service import count_confirmed_participants

    return await count_confirmed_participants(db, trip_id)


async def _to_list_item(db: AsyncSession, trip: Trip, locale: str) -> TripListItem:
    translation = resolve_translation(trip.translations, locale)
    is_full = trip.is_full_override
    if not is_full and trip.capacity is not None:
        booked = await _confirmed_participant_count(db, trip.id)
        is_full = booked >= trip.capacity

    categories = [
        TripCategoryRead(
            id=tc.id,
            race_category=RaceCategoryRead(
                id=tc.race_category.id,
                slug=tc.race_category.slug,
                name=(resolve_translation(tc.race_category.translations, locale) or tc.race_category.translations[0]).name
                if tc.race_category.translations
                else tc.race_category.slug,
            ),
            price=float(tc.price),
            capacity=tc.capacity,
        )
        for tc in trip.categories
    ]

    inclusion_labels = []
    for inc in trip.inclusions:
        inc_translation = resolve_translation(inc.translations, locale)
        if inc_translation:
            inclusion_labels.append(inc_translation.label)

    return TripListItem(
        id=trip.id,
        slug=trip.slug,
        cover_image_url=trip.cover_image_url,
        location_city=trip.location_city,
        location_country=trip.location_country,
        start_date=trip.start_date,
        end_date=trip.end_date,
        title=translation.title if translation else trip.slug,
        summary=translation.summary if translation else None,
        duration_label=_duration_label(trip, translation.duration_label if translation else None),
        categories=categories,
        inclusion_labels=inclusion_labels,
        is_full=is_full,
        is_featured=trip.is_featured,
    )


async def _to_detail(db: AsyncSession, trip: Trip, locale: str) -> TripDetail:
    list_item = await _to_list_item(db, trip, locale)
    translation = resolve_translation(trip.translations, locale)
    return TripDetail(
        **list_item.model_dump(),
        description=translation.description if translation else None,
        images=[img.url for img in trip.images],
    )


def _to_admin_read(trip: Trip) -> TripAdminRead:
    translations = {
        t.locale: TranslationIn(
            locale=t.locale,
            title=t.title,
            summary=t.summary,
            description=t.description,
            meta_description=t.meta_description,
            duration_label=t.duration_label,
        )
        for t in trip.translations
    }
    categories = [
        TripCategoryRead(
            id=tc.id,
            race_category=RaceCategoryRead(
                id=tc.race_category.id,
                slug=tc.race_category.slug,
                name=(resolve_translation(tc.race_category.translations, "en") or tc.race_category.translations[0]).name
                if tc.race_category.translations
                else tc.race_category.slug,
            ),
            price=float(tc.price),
            capacity=tc.capacity,
        )
        for tc in trip.categories
    ]
    images = [{"id": img.id, "url": img.url, "alt_text": img.alt_text, "sort_order": img.sort_order} for img in trip.images]
    inclusions = [
        {
            "id": inc.id,
            "icon": inc.icon,
            "sort_order": inc.sort_order,
            "translations": {t.locale: t.label for t in inc.translations},
        }
        for inc in trip.inclusions
    ]
    return TripAdminRead(
        id=trip.id,
        slug=trip.slug,
        cover_image_url=trip.cover_image_url,
        location_city=trip.location_city,
        location_country=trip.location_country,
        start_date=trip.start_date,
        end_date=trip.end_date,
        capacity=trip.capacity,
        is_full_override=trip.is_full_override,
        is_featured=trip.is_featured,
        status=trip.status,
        translations=translations,
        categories=categories,
        images=images,
        inclusions=inclusions,
    )


async def list_trips(
    db: AsyncSession,
    locale: str,
    status: str | None,
    category: str | None,
    q: str | None,
    featured_only: bool,
    params: PageParams,
) -> Page[TripListItem]:
    stmt = repository.base_public_query()
    stmt = repository.apply_status_filter(stmt, status)
    stmt = repository.apply_category_filter(stmt, category)
    stmt = repository.apply_search(stmt, q, locale)
    stmt = repository.apply_featured_filter(stmt, featured_only)
    stmt = repository.order_by_status(stmt, status)

    trips, total = await paginate(db, stmt, params)
    items = [await _to_list_item(db, trip, locale) for trip in trips]
    return Page(items=items, total=total, page=params.page, page_size=params.page_size)


async def get_trip_by_slug(db: AsyncSession, slug: str, locale: str) -> TripDetail:
    result = await db.execute(select(Trip).where(Trip.slug == slug, Trip.status == TripStatus.published))
    trip = result.scalar_one_or_none()
    if trip is None:
        raise NotFoundError("Trip not found.")
    return await _to_detail(db, trip, locale)


async def get_trip_admin(db: AsyncSession, trip_id: int) -> TripAdminRead:
    trip = await _get_trip_or_404(db, trip_id)
    return _to_admin_read(trip)


async def _get_trip_or_404(db: AsyncSession, trip_id: int) -> Trip:
    trip = await db.get(Trip, trip_id)
    if trip is None:
        raise NotFoundError("Trip not found.")
    return trip


async def create_trip(db: AsyncSession, body: TripCreate) -> TripAdminRead:
    existing = await db.execute(select(Trip).where(Trip.slug == body.slug))
    if existing.scalar_one_or_none():
        raise ConflictError("A trip with this slug already exists.")

    trip = Trip(
        slug=body.slug,
        cover_image_url=body.cover_image_url,
        location_city=body.location_city,
        location_country=body.location_country,
        start_date=body.start_date,
        end_date=body.end_date,
        capacity=body.capacity,
        is_full_override=body.is_full_override,
        is_featured=body.is_featured,
        status=TripStatus(body.status),
    )
    trip.translations = [TripTranslation(**t.model_dump()) for t in body.translations]
    trip.categories = [TripCategory(**c.model_dump()) for c in body.categories]
    db.add(trip)
    await db.commit()
    await db.refresh(trip)
    return _to_admin_read(trip)


async def update_trip(db: AsyncSession, trip_id: int, body: TripUpdate) -> TripAdminRead:
    trip = await _get_trip_or_404(db, trip_id)
    patch = body.model_dump(exclude_unset=True, exclude={"translations", "categories"})
    for field, value in patch.items():
        setattr(trip, field, TripStatus(value) if field == "status" else value)

    if body.translations is not None:
        by_locale = {t.locale: t for t in trip.translations}
        for incoming in body.translations:
            if incoming.locale in by_locale:
                existing = by_locale[incoming.locale]
                existing.title = incoming.title
                existing.summary = incoming.summary
                existing.description = incoming.description
                existing.meta_description = incoming.meta_description
                existing.duration_label = incoming.duration_label
            else:
                trip.translations.append(TripTranslation(**incoming.model_dump()))

    if body.categories is not None:
        trip.categories.clear()
        trip.categories.extend(TripCategory(**c.model_dump()) for c in body.categories)

    await db.commit()
    await db.refresh(trip)
    return _to_admin_read(trip)


async def delete_trip(db: AsyncSession, trip_id: int) -> None:
    trip = await _get_trip_or_404(db, trip_id)
    await db.delete(trip)
    await db.commit()


async def add_image(db: AsyncSession, trip_id: int, body: TripImageIn) -> dict:
    trip = await _get_trip_or_404(db, trip_id)
    image = TripImage(trip_id=trip.id, url=body.url, alt_text=body.alt_text, sort_order=body.sort_order)
    db.add(image)
    await db.commit()
    await db.refresh(image)
    return {"id": image.id, "url": image.url, "alt_text": image.alt_text, "sort_order": image.sort_order}


async def delete_image(db: AsyncSession, trip_id: int, image_id: int) -> None:
    image = await db.get(TripImage, image_id)
    if image is None or image.trip_id != trip_id:
        raise NotFoundError("Trip image not found.")
    await db.delete(image)
    await db.commit()


async def add_inclusion(db: AsyncSession, trip_id: int, body: TripInclusionIn) -> dict:
    await _get_trip_or_404(db, trip_id)
    inclusion = TripInclusion(trip_id=trip_id, icon=body.icon, sort_order=body.sort_order)
    inclusion.translations = [TripInclusionTranslation(locale=t.locale, label=t.label) for t in body.translations]
    db.add(inclusion)
    await db.commit()
    await db.refresh(inclusion)
    return {
        "id": inclusion.id,
        "icon": inclusion.icon,
        "sort_order": inclusion.sort_order,
        "translations": {t.locale: t.label for t in inclusion.translations},
    }


async def update_inclusion(db: AsyncSession, trip_id: int, inclusion_id: int, body: TripInclusionIn) -> dict:
    inclusion = await db.get(TripInclusion, inclusion_id)
    if inclusion is None or inclusion.trip_id != trip_id:
        raise NotFoundError("Trip inclusion not found.")
    inclusion.icon = body.icon
    inclusion.sort_order = body.sort_order
    by_locale = {t.locale: t for t in inclusion.translations}
    for incoming in body.translations:
        if incoming.locale in by_locale:
            by_locale[incoming.locale].label = incoming.label
        else:
            inclusion.translations.append(TripInclusionTranslation(locale=incoming.locale, label=incoming.label))
    await db.commit()
    await db.refresh(inclusion)
    return {
        "id": inclusion.id,
        "icon": inclusion.icon,
        "sort_order": inclusion.sort_order,
        "translations": {t.locale: t.label for t in inclusion.translations},
    }


async def delete_inclusion(db: AsyncSession, trip_id: int, inclusion_id: int) -> None:
    inclusion = await db.get(TripInclusion, inclusion_id)
    if inclusion is None or inclusion.trip_id != trip_id:
        raise NotFoundError("Trip inclusion not found.")
    await db.delete(inclusion)
    await db.commit()


async def list_trips_admin(db: AsyncSession, params: PageParams) -> Page[TripAdminRead]:
    stmt = select(Trip).order_by(Trip.start_date.desc())
    trips, total = await paginate(db, stmt, params)
    return Page(items=[_to_admin_read(t) for t in trips], total=total, page=params.page, page_size=params.page_size)
