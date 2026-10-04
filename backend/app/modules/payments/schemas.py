import datetime

from pydantic import BaseModel


class CreateIntentRequest(BaseModel):
    booking_id: int


class CreateIntentResponse(BaseModel):
    payment_id: int
    client_secret: str
    amount_cents: int


class PaymentRead(BaseModel):
    id: int
    booking_id: int
    provider: str
    status: str
    amount_cents: int


class PaymentAdminRead(BaseModel):
    id: int
    booking_id: int
    booking_status: str
    user_email: str
    trip_title: str
    provider: str
    provider_ref: str
    status: str
    amount_cents: int
    created_at: datetime.datetime
