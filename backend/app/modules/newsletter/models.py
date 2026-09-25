import datetime

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, IDMixin


class NewsletterSubscriber(IDMixin, Base):
    __tablename__ = "newsletter_subscribers"

    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False, index=True)
    subscribed_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    unsubscribed_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    source: Mapped[str | None] = mapped_column(String(100), nullable=True)
