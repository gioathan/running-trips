import datetime

from pydantic import BaseModel, field_validator

from app.modules.payments.settings import validate_payment_url

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
    meta_description: str | None
    images: list[str]


class TripDeletionPreview(BaseModel):
    """What deleting this trip would do — shown to the admin before confirming."""

    bookings_kept: int  # confirmed / cancelled / refunded: records stay, marked as a deleted trip
    bookings_paid: int  # of those, confirmed (customers who have paid — nothing is refunded automatically)
    bookings_to_cancel: int  # pending / awaiting payment: cancelled so nobody pays for a deleted trip
    photos: int  # image files of this trip stored in our bucket


class TripDeletionResult(BaseModel):
    # "removed": no bookings, the trip is gone entirely.
    # "hidden": it had bookings, so it was emptied and hidden and they were kept.
    outcome: str
    bookings_kept: int
    bookings_cancelled: int
    photos_deleted: int


class TripStats(BaseModel):
    races_organized: int
    countries: int


class TranslationIn(BaseModel):
    locale: str
    title: str
    summary: str | None = None
    description: str | None = None
    meta_description: str | None = None
    duration_label: str | None = None


class TripCategoryIn(BaseModel):
    # Set when editing an existing row — it's updated in place rather than
    # replaced, since bookings reference trip_categories.id.
    id: int | None = None
    race_category_id: int
    price: float
    capacity: int | None = None


class TripAdminRead(BaseModel):
    id: int
    slug: str
    cover_image_url: str | None
    external_payment_url: str | None
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
    external_payment_url: str | None = None

    _normalize_payment_url = field_validator("external_payment_url")(validate_payment_url)
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
    external_payment_url: str | None = None

    _normalize_payment_url = field_validator("external_payment_url")(validate_payment_url)
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
