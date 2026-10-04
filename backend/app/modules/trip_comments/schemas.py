import datetime

from pydantic import BaseModel, Field


class TripCommentCreate(BaseModel):
    trip_id: int
    body: str = Field(min_length=1, max_length=2000)


class TripCommentRead(BaseModel):
    id: int
    trip_id: int
    body: str
    created_at: datetime.datetime


class PendingTripCommentRead(BaseModel):
    """A past, confirmed-booking trip the current user hasn't commented on
    yet — prompts shown on the account page (FRONTEND_PLAN.md-style
    'add a comment' section)."""

    trip_id: int
    slug: str
    title: str
    cover_image_url: str | None
    start_date: datetime.date
    end_date: datetime.date


class TripCommentPublic(BaseModel):
    """Shown on the trip page. Only the author's first name — the rest of
    their account (email, surname) is never exposed publicly."""

    id: int
    author_name: str
    body: str
    created_at: datetime.datetime


class TripCommentAdminRead(BaseModel):
    id: int
    trip_id: int
    trip_title: str
    user_email: str
    body: str
    created_at: datetime.datetime
