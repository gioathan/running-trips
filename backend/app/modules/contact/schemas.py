import datetime

from pydantic import BaseModel


class ContactMessageCreate(BaseModel):
    inquiry_type: str = "general"
    trip_id: int | None = None
    message: str


class ContactMessageAdminRead(BaseModel):
    id: int
    user_id: int
    user_email: str
    inquiry_type: str
    trip_id: int | None
    message: str
    status: str
    created_at: datetime.datetime


class ContactMessageStatusUpdate(BaseModel):
    status: str
