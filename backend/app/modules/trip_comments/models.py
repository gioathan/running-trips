import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, IDMixin


class TripComment(IDMixin, Base):
    __tablename__ = "trip_comments"
    __table_args__ = (UniqueConstraint("user_id", "trip_id", name="uq_trip_comments_user_id_trip_id"),)

    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    trip_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("trips.id", ondelete="CASCADE"), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), nullable=False)
