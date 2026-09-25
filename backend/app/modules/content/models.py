from enum import StrEnum

from sqlalchemy import BigInteger, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, IDMixin, TimestampMixin


class SectionType(StrEnum):
    hero = "hero"
    widget_list = "widget_list"
    stats_band = "stats_band"
    testimonials = "testimonials"
    faq = "faq"
    comparison_table = "comparison_table"
    steps = "steps"
    cta_banner = "cta_banner"
    richtext = "richtext"


class Page(IDMixin, TimestampMixin, Base):
    __tablename__ = "pages"

    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)

    sections: Mapped[list["ContentSection"]] = relationship(
        back_populates="page", cascade="all, delete-orphan", lazy="selectin", order_by="ContentSection.sort_order"
    )


class ContentSection(IDMixin, Base):
    __tablename__ = "content_sections"

    page_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("pages.id", ondelete="CASCADE"), nullable=False)
    type: Mapped[SectionType] = mapped_column(String(30), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)

    page: Mapped["Page"] = relationship(back_populates="sections")
    translations: Mapped[list["ContentSectionTranslation"]] = relationship(
        back_populates="section", cascade="all, delete-orphan", lazy="selectin"
    )


class ContentSectionTranslation(IDMixin, Base):
    __tablename__ = "content_section_translations"
    __table_args__ = (UniqueConstraint("section_id", "locale"),)

    section_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("content_sections.id", ondelete="CASCADE"), nullable=False
    )
    locale: Mapped[str] = mapped_column(String(2), nullable=False)
    data: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}", nullable=False)

    section: Mapped["ContentSection"] = relationship(back_populates="translations")


class SiteSetting(Base):
    __tablename__ = "site_settings"

    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    value: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}", nullable=False)
