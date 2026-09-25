import datetime

from pydantic import BaseModel, ConfigDict


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: str | None
    phone: str | None
    role: str
    locale: str
    email_verified: bool


class UserUpdate(BaseModel):
    full_name: str | None = None
    phone: str | None = None
    locale: str | None = None


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
    nationality: str | None = None
    passport_number: str | None = None
    emergency_contact_name: str | None = None
    emergency_contact_phone: str | None = None
    shirt_size: str | None = None
    extra: dict | None = None
