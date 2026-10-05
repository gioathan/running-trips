import datetime
from enum import StrEnum

from sqlalchemy import BigInteger, Date, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, IDMixin, TimestampMixin


class BookingStatus(StrEnum):
    pending = "pending"
    awaiting_payment = "awaiting_payment"
    confirmed = "confirmed"
    cancelled = "cancelled"
    refunded = "refunded"


class PaymentMethod(StrEnum):
    stripe = "stripe"
    external = "external"


ACTIVE_BOOKING_STATUSES = (BookingStatus.pending, BookingStatus.awaiting_payment, BookingStatus.confirmed)


class Booking(IDMixin, TimestampMixin, Base):
    __tablename__ = "bookings"

    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    trip_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("trips.id", ondelete="RESTRICT"), nullable=False)
    trip_category_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("trip_categories.id", ondelete="RESTRICT"), nullable=False
    )
    status: Mapped[BookingStatus] = mapped_column(
        String(20), default=BookingStatus.pending, server_default=BookingStatus.pending, nullable=False, index=True
    )
    # Which flow the booking was created under (payments/settings.py) —
    # fixed at creation, so changing the site's payment mode later doesn't
    # change how existing bookings expire or get paid.
    payment_method: Mapped[PaymentMethod] = mapped_column(
        String(20), default=PaymentMethod.stripe, server_default=PaymentMethod.stripe, nullable=False
    )
    # Who to reach about this booking — may differ from the account's email.
    # Nullable only for bookings made before these fields existed.
    contact_email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    contact_phone: Mapped[str | None] = mapped_column(String(20), nullable=True)  # E.164, e.g. +306912345678
    emergency_contact_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    emergency_contact_phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    participant_count: Mapped[int] = mapped_column(Integer, nullable=False)
    total_amount_cents: Mapped[int] = mapped_column(Integer, nullable=False)

    participants: Mapped[list["BookingParticipant"]] = relationship(
        back_populates="booking", cascade="all, delete-orphan", lazy="selectin"
    )


class BookingParticipant(IDMixin, Base):
    __tablename__ = "booking_participants"

    booking_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    date_of_birth: Mapped[datetime.date | None] = mapped_column(Date, nullable=True)
    gender: Mapped[str | None] = mapped_column(String(10), nullable=True)
    nationality: Mapped[str | None] = mapped_column(String(100), nullable=True)
    passport_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    shirt_size: Mapped[str | None] = mapped_column(String(10), nullable=True)
    extra: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}", nullable=False)

    booking: Mapped["Booking"] = relationship(back_populates="participants")
