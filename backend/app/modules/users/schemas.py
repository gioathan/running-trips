import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _blank_to_none(value):
    """An emptied form field means "not set", not an empty string."""
    if isinstance(value, str):
        value = value.strip()
        return value or None
    return value


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: str | None
    phone: str | None
    role: str
    locale: str
    email_verified: bool


# Lengths match the columns (users/models.py): anything longer used to reach
# the database and come back as a 500 instead of a validation error.
class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=50)
    locale: str | None = None

    _blank = field_validator("full_name", "phone", mode="before")(_blank_to_none)


class TravelProfileRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    date_of_birth: datetime.date | None
    nationality: str | None
    passport_number: str | None
    emergency_contact_name: str | None
    emergency_contact_phone: str | None
    shirt_size: str | None
    extra: dict


class TravelProfileUpdate(BaseModel):
    date_of_birth: datetime.date | None = None
    nationality: str | None = Field(default=None, max_length=100)
    passport_number: str | None = Field(default=None, max_length=50)
    emergency_contact_name: str | None = Field(default=None, max_length=255)
    emergency_contact_phone: str | None = Field(default=None, max_length=50)
    shirt_size: str | None = Field(default=None, max_length=10)
    extra: dict | None = None

    _blank = field_validator(
        "nationality", "passport_number", "emergency_contact_name", "emergency_contact_phone", "shirt_size", mode="before"
    )(_blank_to_none)
