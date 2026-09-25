import datetime
from enum import StrEnum

from sqlalchemy import BigInteger, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, IDMixin


class PaymentProvider(StrEnum):
    stripe = "stripe"


class PaymentStatus(StrEnum):
    requires_payment = "requires_payment"
    succeeded = "succeeded"
    failed = "failed"
    refunded = "refunded"


class Payment(IDMixin, Base):
    __tablename__ = "payments"

    booking_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("bookings.id", ondelete="RESTRICT"), nullable=False)
    provider: Mapped[PaymentProvider] = mapped_column(
        String(20), default=PaymentProvider.stripe, server_default=PaymentProvider.stripe, nullable=False
    )
    provider_ref: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    amount_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[PaymentStatus] = mapped_column(
        String(20), default=PaymentStatus.requires_payment, server_default=PaymentStatus.requires_payment, nullable=False
    )
    raw_payload: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}", nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), nullable=False)
