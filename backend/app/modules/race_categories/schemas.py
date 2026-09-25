from pydantic import BaseModel


class RaceCategoryRead(BaseModel):
    """Locale-resolved — what public endpoints return."""

    id: int
    slug: str
    name: str


class TranslationIn(BaseModel):
    locale: str
    name: str


class RaceCategoryAdminRead(BaseModel):
    """All locales at once — what the admin edit form loads."""

    id: int
    slug: str
    translations: dict[str, str]  # locale -> name


class RaceCategoryCreate(BaseModel):
    slug: str
    translations: list[TranslationIn]


class RaceCategoryUpdate(BaseModel):
    slug: str | None = None
    translations: list[TranslationIn] | None = None
