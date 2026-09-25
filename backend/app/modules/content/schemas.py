from pydantic import BaseModel


class SectionRead(BaseModel):
    """Locale-resolved — what public endpoints return."""

    id: int
    type: str
    sort_order: int
    data: dict


class PageRead(BaseModel):
    slug: str
    sections: list[SectionRead]


class SectionTranslationIn(BaseModel):
    locale: str
    data: dict


class SectionAdminRead(BaseModel):
    id: int
    type: str
    sort_order: int
    translations: dict[str, dict]  # locale -> data


class SectionIn(BaseModel):
    id: int | None = None  # existing section id to update, omit to create
    type: str
    sort_order: int = 0
    translations: list[SectionTranslationIn]


class PageAdminRead(BaseModel):
    slug: str
    sections: list[SectionAdminRead]


class PageUpdate(BaseModel):
    sections: list[SectionIn]


class SiteSettingRead(BaseModel):
    key: str
    value: dict


class SiteSettingsUpdate(BaseModel):
    settings: dict[str, dict]  # key -> value
