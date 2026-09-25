import datetime

from pydantic import BaseModel


class ParticipantIn(BaseModel):
    full_name: str
    date_of_birth: datetime.date | None = None
    nationality: str | None = None
    passport_number: str | None = None
    shirt_size: str | None = None
    extra: dict = {}


class ParticipantRead(ParticipantIn):
    id: int


class BookingCreate(BaseModel):
    trip_id: int
    trip_category_id: int
    participants: list[ParticipantIn]


class TripSummary(BaseModel):
    id: int
    slug: str
    title: str
    cover_image_url: str | None
    start_date: datetime.date
    end_date: datetime.date


class BookingRead(BaseModel):
    id: int
    trip: TripSummary
    status: str
    participant_count: int
    total_amount_cents: int
    participants: list[ParticipantRead]
    created_at: datetime.datetime


class BookingAdminRead(BookingRead):
    user_id: int
    user_email: str


class BookingStatusUpdate(BaseModel):
    status: str
