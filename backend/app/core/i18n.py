from typing import Protocol, TypeVar


class HasLocale(Protocol):
    locale: str


T = TypeVar("T", bound=HasLocale)

DEFAULT_LOCALE = "en"


def resolve_translation(translations: list[T], locale: str) -> T | None:
    """Resolution order: requested locale -> DEFAULT_LOCALE -> whatever
    exists. Lets a trip/category/section render even if the admin hasn't
    filled in every language yet (BACKEND_PLAN.md §10)."""
    by_locale = {t.locale: t for t in translations}
    return by_locale.get(locale) or by_locale.get(DEFAULT_LOCALE) or (translations[0] if translations else None)
