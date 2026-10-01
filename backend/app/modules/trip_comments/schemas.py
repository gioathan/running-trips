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
