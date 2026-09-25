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
