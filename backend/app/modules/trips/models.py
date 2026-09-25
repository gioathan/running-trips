import datetime
from enum import StrEnum

from sqlalchemy import BigInteger, Boolean, Date, ForeignKey, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, IDMixin, TimestampMixin
from app.modules.race_categories.models import RaceCategory


class TripStatus(StrEnum):
    draft = "draft"
    published = "published"
    archived = "archived"


class Trip(IDMixin, TimestampMixin, Base):
    __tablename__ = "trips"

    slug: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    cover_image_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    location_city: Mapped[str | None] = mapped_column(String(255), nullable=True)
    location_country: Mapped[str | None] = mapped_column(String(255), nullable=True)
    start_date: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    end_date: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    capacity: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_full_override: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)
    status: Mapped[TripStatus] = mapped_column(
        String(20), default=TripStatus.draft, server_default=TripStatus.draft, nullable=False, index=True
    )

    translations: Mapped[list["TripTranslation"]] = relationship(
        back_populates="trip", cascade="all, delete-orphan", lazy="selectin"
    )
    categories: Mapped[list["TripCategory"]] = relationship(
        back_populates="trip", cascade="all, delete-orphan", lazy="selectin", order_by="TripCategory.id"
    )
    images: Mapped[list["TripImage"]] = relationship(
        back_populates="trip", cascade="all, delete-orphan", lazy="selectin", order_by="TripImage.sort_order"
    )
    inclusions: Mapped[list["TripInclusion"]] = relationship(
        back_populates="trip", cascade="all, delete-orphan", lazy="selectin", order_by="TripInclusion.sort_order"
    )


class TripTranslation(IDMixin, Base):
    __tablename__ = "trip_translations"
    __table_args__ = (UniqueConstraint("trip_id", "locale"),)

    trip_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("trips.id", ondelete="CASCADE"), nullable=False)
    locale: Mapped[str] = mapped_column(String(2), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    summary: Mapped[str | None] = mapped_column(String(300), nullable=True)
    description: Mapped[str | None] = mapped_column(nullable=True)
    meta_description: Mapped[str | None] = mapped_column(String(300), nullable=True)
    duration_label: Mapped[str | None] = mapped_column(String(100), nullable=True)

    trip: Mapped["Trip"] = relationship(back_populates="translations")


class TripCategory(IDMixin, Base):
    """A race category (e.g. 10km) offered on this trip, with its own
    price/capacity — a trip offering both 10km and 5km can price them
    differently."""

    __tablename__ = "trip_categories"

    trip_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("trips.id", ondelete="CASCADE"), nullable=False)
    race_category_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("race_categories.id", ondelete="RESTRICT"), nullable=False
    )
    price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    capacity: Mapped[int | None] = mapped_column(Integer, nullable=True)

    trip: Mapped["Trip"] = relationship(back_populates="categories")
    race_category: Mapped["RaceCategory"] = relationship(lazy="selectin")


class TripImage(IDMixin, Base):
    __tablename__ = "trip_images"

    trip_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("trips.id", ondelete="CASCADE"), nullable=False)
    url: Mapped[str] = mapped_column(String(1000), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    alt_text: Mapped[str | None] = mapped_column(String(255), nullable=True)

    trip: Mapped["Trip"] = relationship(back_populates="images")


class TripInclusion(IDMixin, Base):
    """A variable-length 'what's included' bullet — admin adds/removes
    freely per trip."""

    __tablename__ = "trip_inclusions"

    trip_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("trips.id", ondelete="CASCADE"), nullable=False)
    icon: Mapped[str | None] = mapped_column(String(100), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)

    trip: Mapped["Trip"] = relationship(back_populates="inclusions")
    translations: Mapped[list["TripInclusionTranslation"]] = relationship(
        back_populates="inclusion", cascade="all, delete-orphan", lazy="selectin"
    )


class TripInclusionTranslation(IDMixin, Base):
    __tablename__ = "trip_inclusion_translations"
    __table_args__ = (UniqueConstraint("inclusion_id", "locale"),)

    inclusion_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("trip_inclusions.id", ondelete="CASCADE"), nullable=False
    )
    locale: Mapped[str] = mapped_column(String(2), nullable=False)
    label: Mapped[str] = mapped_column(String(500), nullable=False)

    inclusion: Mapped["TripInclusion"] = relationship(back_populates="translations")
