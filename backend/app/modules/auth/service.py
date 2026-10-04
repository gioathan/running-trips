import datetime

from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import AdminAccountError, EmailAlreadyRegisteredError, InvalidCredentialsError, UnauthorizedError
from app.core.security import (
    create_access_token,
    create_purpose_token,
    decode_purpose_token,
    generate_opaque_token,
    hash_opaque_token,
    refresh_token_usable,
    hash_password,
    verify_password,
)
from app.modules.users.models import OAuthAccount, OAuthProvider, RefreshToken, User, UserRole

settings = get_settings()

PURPOSE_VERIFY_EMAIL = "verify_email"
PURPOSE_RESET_PASSWORD = "reset_password"


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email.lower()))
    return result.scalar_one_or_none()


async def signup(db: AsyncSession, email: str, password: str, full_name: str | None, locale: str) -> User:
    if await get_user_by_email(db, email):
        raise EmailAlreadyRegisteredError("An account with this email already exists.")
    user = User(
        email=email.lower(),
        password_hash=hash_password(password),
        full_name=full_name,
        locale=locale if locale in ("en", "el") else "en",
        role=UserRole.user,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def authenticate(db: AsyncSession, email: str, password: str) -> User:
    user = await get_user_by_email(db, email)
    if user is None or user.password_hash is None or not verify_password(password, user.password_hash):
        raise InvalidCredentialsError("Incorrect email or password.")
    if not user.is_active:
        raise InvalidCredentialsError("Account is disabled.")
    _reject_admin(user)
    return user


def _reject_admin(user: User) -> None:
    # A user-flow session for an admin is useless — every user endpoint
    # rejects role=admin tokens (get_current_user) — so say where to go
    # instead of issuing it. Checked only after the password/Google token is
    # verified, so it doesn't reveal which emails are admins.
    if user.role == UserRole.admin:
        raise AdminAccountError("Admin accounts sign in at /admin/login.")


async def login_or_signup_with_google(db: AsyncSession, raw_id_token: str, locale: str) -> User:
    if not settings.google_oauth_client_id:
        raise UnauthorizedError("Google sign-in is not configured.")
    try:
        claims = google_id_token.verify_oauth2_token(
            raw_id_token, google_requests.Request(), settings.google_oauth_client_id
        )
    except ValueError as exc:
        raise UnauthorizedError("Invalid Google token.") from exc

    google_sub = claims["sub"]
    email = claims.get("email")

    result = await db.execute(
        select(OAuthAccount).where(
            OAuthAccount.provider == OAuthProvider.google, OAuthAccount.provider_user_id == google_sub
        )
    )
    oauth_account = result.scalar_one_or_none()
    if oauth_account:
        user = await db.get(User, oauth_account.user_id)
        _reject_admin(user)
        return user

    user = await get_user_by_email(db, email) if email else None
    if user is not None:
        _reject_admin(user)
    if user is not None and not claims.get("email_verified"):
        # Linking to an existing account by an email Google hasn't verified
        # would let someone who merely *claims* that address take it over.
        raise EmailAlreadyRegisteredError("An account with this email already exists.")
    if user is None:
        user = User(
            email=email.lower() if email else f"google-{google_sub}@no-email.invalid",
            full_name=claims.get("name"),
            locale=locale if locale in ("en", "el") else "en",
            role=UserRole.user,
            email_verified=bool(claims.get("email_verified")),
        )
        db.add(user)
        await db.flush()

    db.add(
        OAuthAccount(
            user_id=user.id,
            provider=OAuthProvider.google,
            provider_user_id=google_sub,
            created_at=datetime.datetime.now(datetime.UTC),
        )
    )
    await db.commit()
    await db.refresh(user)
    return user


def _refresh_ttl(remember_me: bool) -> datetime.timedelta:
    days = settings.refresh_token_ttl_days_remember_me if remember_me else settings.refresh_token_ttl_days
    return datetime.timedelta(days=days)


async def issue_tokens(
    db: AsyncSession, user: User, remember_me: bool, user_agent: str | None, ip: str | None
) -> tuple[str, str]:
    access_token = create_access_token(
        user.id, user.role, datetime.timedelta(minutes=settings.access_token_ttl_minutes)
    )
    raw_refresh, refresh_hash = generate_opaque_token()
    now = datetime.datetime.now(datetime.UTC)
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=refresh_hash,
            expires_at=now + _refresh_ttl(remember_me),
            remember_me=remember_me,
            user_agent=user_agent,
            ip=ip,
            created_at=now,
        )
    )
    await db.commit()
    return access_token, raw_refresh


async def rotate_refresh_token(
    db: AsyncSession, raw_refresh_token: str, user_agent: str | None, ip: str | None
) -> tuple[str, str, bool]:
    token_hash = hash_opaque_token(raw_refresh_token)
    result = await db.execute(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    stored = result.scalar_one_or_none()
    now = datetime.datetime.now(datetime.UTC)
    if stored is None or not refresh_token_usable(stored.revoked_at, stored.rotated_at, stored.expires_at, now):
        raise UnauthorizedError("Refresh token is invalid or expired.")

    if stored.revoked_at is None:
        stored.revoked_at = now
        stored.rotated_at = now
    user = await db.get(User, stored.user_id)
    if user is None or not user.is_active:
        raise UnauthorizedError("Account not found or inactive.")

    access_token, raw_refresh = await issue_tokens(db, user, stored.remember_me, user_agent, ip)
    return access_token, raw_refresh, stored.remember_me


async def revoke_refresh_token(db: AsyncSession, raw_refresh_token: str) -> None:
    token_hash = hash_opaque_token(raw_refresh_token)
    result = await db.execute(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    stored = result.scalar_one_or_none()
    if stored and stored.revoked_at is None:
        stored.revoked_at = datetime.datetime.now(datetime.UTC)
        await db.commit()


def build_verify_email_token(user: User) -> str:
    return create_purpose_token(user.id, PURPOSE_VERIFY_EMAIL, datetime.timedelta(hours=24))


async def verify_email(db: AsyncSession, token: str) -> User:
    try:
        payload = decode_purpose_token(token, PURPOSE_VERIFY_EMAIL)
    except Exception as exc:
        raise UnauthorizedError("Invalid or expired verification link.") from exc
    user = await db.get(User, int(payload["sub"]))
    if user is None:
        raise UnauthorizedError("Invalid or expired verification link.")
    user.email_verified = True
    await db.commit()
    return user


def _password_fingerprint(user: User) -> str:
    # Changes whenever the password does, so a reset link stops working
    # once it (or any other password change) has been used.
    return hash_opaque_token(user.password_hash or "")[:16]


def build_password_reset_token(user: User) -> str:
    return create_purpose_token(
        user.id, PURPOSE_RESET_PASSWORD, datetime.timedelta(hours=1), extra={"pwf": _password_fingerprint(user)}
    )


async def reset_password(db: AsyncSession, token: str, new_password: str) -> User:
    try:
        payload = decode_purpose_token(token, PURPOSE_RESET_PASSWORD)
    except Exception as exc:
        raise UnauthorizedError("Invalid or expired reset link.") from exc
    user = await db.get(User, int(payload["sub"]))
    if user is None or payload.get("pwf") != _password_fingerprint(user):
        raise UnauthorizedError("Invalid or expired reset link.")
    user.password_hash = hash_password(new_password)
    # Whoever triggered a reset may be locking out an attacker — end every
    # existing session along with the old password.
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=datetime.datetime.now(datetime.UTC))
    )
    await db.commit()
    return user
