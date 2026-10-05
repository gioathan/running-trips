"""Admin-configurable payment mode.

`stripe`: bookings are paid on-site through Stripe (PaymentIntent + webhook).
`external`: bookings are recorded on-site, the customer is sent to an
external payment link (e.g. a partner office's payment page), and an admin
confirms the booking by hand once the payment is reported.

Stored as one row in `site_settings` (key "payments") — no schema of its own.
"""

import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.content.models import SiteSetting

SETTINGS_KEY = "payments"


def validate_payment_url(value: str | None) -> str | None:
    """Empty → None; otherwise must be an absolute http(s) URL (it's rendered
    as a link customers are told to pay through)."""
    value = (value or "").strip()
    if not value:
        return None
    if not value.lower().startswith(("https://", "http://")):
        raise ValueError("Payment link must start with https:// or http://")
    return value


class PaymentSettings(BaseModel):
    mode: Literal["stripe", "external"] = "stripe"
    # Default external payment link; a trip's own external_payment_url wins.
    # May contain {booking_id}, replaced with the booking's reference.
    external_url: str | None = None
    # How long an unpaid external booking holds its seats before the worker
    # cancels it.
    external_hold_days: int = Field(default=3, ge=1, le=60)

    _normalize_url = field_validator("external_url")(validate_payment_url)

    @model_validator(mode="after")
    def _external_needs_a_default_link(self) -> "PaymentSettings":
        # Guarantees every trip is payable in external mode, with or without
        # its own link.
        if self.mode == "external" and not self.external_url:
            raise ValueError("Set a default payment link before switching to external payments.")
        return self


async def get_payment_settings(db: AsyncSession) -> PaymentSettings:
    row = await db.get(SiteSetting, SETTINGS_KEY)
    return PaymentSettings(**row.value) if row else PaymentSettings()


async def save_payment_settings(db: AsyncSession, settings: PaymentSettings) -> PaymentSettings:
    row = await db.get(SiteSetting, SETTINGS_KEY)
    if row is None:
        db.add(SiteSetting(key=SETTINGS_KEY, value=settings.model_dump()))
    else:
        row.value = settings.model_dump()
    await db.commit()
    return settings


def external_payment_url(settings: PaymentSettings, trip_url: str | None, booking_id: int) -> str | None:
    url = trip_url or settings.external_url
    return url.replace("{booking_id}", str(booking_id)) if url else None


def external_payment_due_at(settings: PaymentSettings, created_at: datetime.datetime) -> datetime.datetime:
    return created_at + datetime.timedelta(days=settings.external_hold_days)
