import datetime

from pydantic import BaseModel, EmailStr


class SubscribeRequest(BaseModel):
    email: EmailStr
    source: str | None = None
    # Language of the welcome email (subscribers have no account/users.locale).
    locale: str = "en"


class UnsubscribeRequest(BaseModel):
    token: str


class SubscriberAdminRead(BaseModel):
    id: int
    email: str
    subscribed_at: datetime.datetime
    unsubscribed_at: datetime.datetime | None
    source: str | None
