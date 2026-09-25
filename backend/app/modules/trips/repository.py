import datetime

from sqlalchemy import Select, select
from sqlalchemy.orm import aliased

from app.modules.race_categories.models import RaceCategory
from app.modules.trips.models import Trip, TripCategory, TripStatus, TripTranslation


def base_public_query() -> Select:
    return select(Trip).where(Trip.status == TripStatus.published).distinct()


def apply_status_filter(stmt: Select, status: str | None) -> Select:
    today = datetime.date.today()
    if status == "upcoming":
        return stmt.where(Trip.end_date >= today)
    if status == "past":
        return stmt.where(Trip.end_date < today)
    return stmt


def apply_category_filter(stmt: Select, category_slug: str | None) -> Select:
    if not category_slug:
        return stmt
    return stmt.join(TripCategory, TripCategory.trip_id == Trip.id).join(
        RaceCategory, RaceCategory.id == TripCategory.race_category_id
    ).where(RaceCategory.slug == category_slug)


def apply_search(stmt: Select, q: str | None, locale: str) -> Select:
    if not q:
        return stmt
    tt = aliased(TripTranslation)
    pattern = f"%{q}%"
    return stmt.join(tt, tt.trip_id == Trip.id).where(
        tt.locale.in_({locale, "en"}),
        (tt.title.ilike(pattern) | Trip.location_city.ilike(pattern) | Trip.location_country.ilike(pattern)),
    )


def apply_featured_filter(stmt: Select, featured_only: bool) -> Select:
    if featured_only:
        return stmt.where(Trip.is_featured.is_(True))
    return stmt


def order_by_status(stmt: Select, status: str | None) -> Select:
    if status == "past":
        return stmt.order_by(Trip.start_date.desc())
    return stmt.order_by(Trip.start_date.asc())
