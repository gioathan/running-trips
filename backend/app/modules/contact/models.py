import datetime
from enum import StrEnum

from sqlalchemy import BigInteger, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, IDMixin


class InquiryType(StrEnum):
    general = "general"
    booking = "booking"
    custom_trip = "custom_trip"
    press = "press"


class MessageStatus(StrEnum):
    new = "new"
    replied = "replied"
    archived = "archived"


class ContactMessage(IDMixin, Base):
    __tablename__ = "contact_messages"

    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    inquiry_type: Mapped[InquiryType] = mapped_column(
        String(20), default=InquiryType.general, server_default=InquiryType.general, nullable=False
    )
    trip_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("trips.id", ondelete="SET NULL"), nullable=True)
    message: Mapped[str] = mapped_column(nullable=False)
    status: Mapped[MessageStatus] = mapped_column(
        String(20), default=MessageStatus.new, server_default=MessageStatus.new, nullable=False, index=True
    )
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), nullable=False)
