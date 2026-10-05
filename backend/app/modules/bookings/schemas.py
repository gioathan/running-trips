import datetime
import re

from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator


# Names go onto race bibs and hotel rooming lists, which need the Latin
# spelling (as on an ID card) — so Greek/Cyrillic etc. are rejected rather
# than transliterated by guesswork. Accented Latin letters are fine.
_LATIN_NAME = re.compile(r"^[A-Za-z\u00C0-\u024F][A-Za-z\u00C0-\u024F .'\-]*$")
# E.164: "+", country code, subscriber number — 8 to 15 digits in total.
_E164_PHONE = re.compile(r"^\+[1-9]\d{7,14}$")

Gender = Literal["male", "female", "other"]
ShirtSize = Literal["XS", "S", "M", "L", "XL", "XXL"]


def _latin_full_name(value: str) -> str:
    value = " ".join(value.split())
    if not _LATIN_NAME.match(value):
        raise ValueError("Name must be written in Latin characters.")
    if " " not in value:
        raise ValueError("Enter both first name and surname.")
    return value


def _e164_phone(value: str | None) -> str | None:
    if value is None or not value.strip():
        return None
    value = re.sub(r"[\s().\-]", "", value)
    if not _E164_PHONE.match(value):
        raise ValueError("Phone must include the country code, e.g. +306912345678.")
    return value


def _blank_to_none(value):
    """Trim optional text fields; an empty form field means "not given"."""
    if isinstance(value, str):
        return value.strip() or None
    return value


class ParticipantIn(BaseModel):
    full_name: str = Field(max_length=255)
    date_of_birth: datetime.date
    gender: Gender
    nationality: str | None = Field(default=None, max_length=100)
    shirt_size: ShirtSize | None = None

    _blank_optionals = field_validator("nationality", "shirt_size", mode="before")(_blank_to_none)
    _latin_name = field_validator("full_name")(_latin_full_name)

    @field_validator("date_of_birth")
    @classmethod
    def _plausible_birth_date(cls, value: datetime.date) -> datetime.date:
        if not datetime.date(1900, 1, 1) <= value < datetime.date.today():
            raise ValueError("Enter a valid date of birth.")
        return value


class ParticipantRead(BaseModel):
    """Not derived from ParticipantIn: bookings made before the extra fields
    were required have participants without them."""

    id: int
    full_name: str
    date_of_birth: datetime.date | None
    gender: str | None
    nationality: str | None
    shirt_size: str | None


class BookingCreate(BaseModel):
    trip_id: int
    trip_category_id: int
    contact_email: EmailStr
    contact_phone: str
    emergency_contact_name: str | None = Field(default=None, max_length=255)
    emergency_contact_phone: str | None = None
    participants: list[ParticipantIn] = Field(min_length=1, max_length=20)

    _blank_optionals = field_validator("emergency_contact_name", mode="before")(_blank_to_none)
    _emergency_phone = field_validator("emergency_contact_phone")(_e164_phone)

    @field_validator("contact_phone")
    @classmethod
    def _contact_phone_required(cls, value: str) -> str:
        phone = _e164_phone(value)
        if phone is None:
            raise ValueError("Phone must include the country code, e.g. +306912345678.")
        return phone


class TripSummary(BaseModel):
    id: int
    slug: str
    title: str
    cover_image_url: str | None
    start_date: datetime.date
    end_date: datetime.date
    # The trip was deleted by an admin; it has no page to link to any more.
    deleted: bool = False


class BookingRead(BaseModel):
    id: int
    trip: TripSummary
    status: str
    payment_method: str
    # Set only while an external-payment booking is still unpaid: where the
    # customer pays, and when the seat hold lapses.
    payment_url: str | None = None
    payment_due_at: datetime.datetime | None = None
    contact_email: str | None
    contact_phone: str | None
    emergency_contact_name: str | None
    emergency_contact_phone: str | None
    participant_count: int
    total_amount_cents: int
    participants: list[ParticipantRead]
    created_at: datetime.datetime


class BookingAdminRead(BookingRead):
    user_id: int
    user_email: str


class BookingStatusUpdate(BaseModel):
    status: str
