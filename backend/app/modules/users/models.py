import datetime
from enum import StrEnum

from sqlalchemy import BigInteger, Boolean, Date, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, IDMixin, TimestampMixin


class UserRole(StrEnum):
    user = "user"
    admin = "admin"


class Locale(StrEnum):
    en = "en"
    el = "el"


class OAuthProvider(StrEnum):
    google = "google"


class User(IDMixin, TimestampMixin, Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False, index=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    full_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    role: Mapped[UserRole] = mapped_column(
        String(20), default=UserRole.user, server_default=UserRole.user, nullable=False
    )
    locale: Mapped[Locale] = mapped_column(String(2), default=Locale.en, server_default=Locale.en, nullable=False)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true", nullable=False)

    oauth_accounts: Mapped[list["OAuthAccount"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    travel_profile: Mapped["UserTravelProfile | None"] = relationship(
        back_populates="user", cascade="all, delete-orphan", uselist=False
    )


class OAuthAccount(IDMixin, Base):
    __tablename__ = "oauth_accounts"

    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    provider: Mapped[OAuthProvider] = mapped_column(String(20), nullable=False)
    provider_user_id: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    user: Mapped["User"] = relationship(back_populates="oauth_accounts")


class RefreshToken(IDMixin, Base):
    __tablename__ = "refresh_tokens"

    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    expires_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    remember_me: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)
    ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class UserTravelProfile(IDMixin, Base):
    __tablename__ = "user_travel_profiles"

    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    date_of_birth: Mapped[datetime.date | None] = mapped_column(Date, nullable=True)
    nationality: Mapped[str | None] = mapped_column(String(100), nullable=True)
    passport_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    emergency_contact_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    emergency_contact_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    shirt_size: Mapped[str | None] = mapped_column(String(10), nullable=True)
    extra: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}", nullable=False)

    user: Mapped["User"] = relationship(back_populates="travel_profile")
