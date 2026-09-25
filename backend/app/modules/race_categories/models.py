from sqlalchemy import BigInteger, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, IDMixin, TimestampMixin


class RaceCategory(IDMixin, TimestampMixin, Base):
    __tablename__ = "race_categories"

    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)

    translations: Mapped[list["RaceCategoryTranslation"]] = relationship(
        back_populates="race_category", cascade="all, delete-orphan", lazy="selectin"
    )


class RaceCategoryTranslation(IDMixin, Base):
    __tablename__ = "race_category_translations"
    __table_args__ = (UniqueConstraint("race_category_id", "locale"),)

    race_category_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("race_categories.id", ondelete="CASCADE"), nullable=False
    )
    locale: Mapped[str] = mapped_column(String(2), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)

    race_category: Mapped["RaceCategory"] = relationship(back_populates="translations")
