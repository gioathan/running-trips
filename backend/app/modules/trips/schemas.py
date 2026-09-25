import datetime

from pydantic import BaseModel

from app.modules.race_categories.schemas import RaceCategoryRead


class TripCategoryRead(BaseModel):
    id: int
    race_category: RaceCategoryRead
    price: float
    capacity: int | None


class TripListItem(BaseModel):
    """Card view — locale-resolved."""

    id: int
    slug: str
    cover_image_url: str | None
    location_city: str | None
    location_country: str | None
    start_date: datetime.date
    end_date: datetime.date
    title: str
    summary: str | None
    duration_label: str
    categories: list[TripCategoryRead]
    inclusion_labels: list[str]
    is_full: bool
    is_featured: bool


class TripDetail(TripListItem):
    description: str | None
    images: list[str]


class TranslationIn(BaseModel):
    locale: str
    title: str
    summary: str | None = None
    description: str | None = None
    meta_description: str | None = None
    duration_label: str | None = None


class TripCategoryIn(BaseModel):
    race_category_id: int
    price: float
    capacity: int | None = None


class TripAdminRead(BaseModel):
    id: int
    slug: str
    cover_image_url: str | None
    location_city: str | None
    location_country: str | None
    start_date: datetime.date
    end_date: datetime.date
    capacity: int | None
    is_full_override: bool
    is_featured: bool
    status: str
    translations: dict[str, TranslationIn]
    categories: list[TripCategoryRead]
    images: list[dict]
    inclusions: list[dict]


class TripCreate(BaseModel):
    slug: str
    cover_image_url: str | None = None
    location_city: str | None = None
    location_country: str | None = None
    start_date: datetime.date
    end_date: datetime.date
    capacity: int | None = None
    is_full_override: bool = False
    is_featured: bool = False
    status: str = "draft"
    translations: list[TranslationIn]
    categories: list[TripCategoryIn] = []


class TripUpdate(BaseModel):
    slug: str | None = None
    cover_image_url: str | None = None
    location_city: str | None = None
    location_country: str | None = None
    start_date: datetime.date | None = None
    end_date: datetime.date | None = None
    capacity: int | None = None
    is_full_override: bool | None = None
    is_featured: bool | None = None
    status: str | None = None
    translations: list[TranslationIn] | None = None
    categories: list[TripCategoryIn] | None = None


class TripImageIn(BaseModel):
    url: str
    alt_text: str | None = None
    sort_order: int = 0


class InclusionTranslationIn(BaseModel):
    locale: str
    label: str


class TripInclusionIn(BaseModel):
    icon: str | None = None
    sort_order: int = 0
    translations: list[InclusionTranslationIn]
