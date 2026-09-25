from typing import Annotated, Literal

import jwt
from fastapi import Cookie, Depends, Header, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ForbiddenError, RateLimitedError, UnauthorizedError
from app.core.redis import get_redis
from app.core.security import decode_access_token
from app.db.session import get_db

DbSession = Annotated[AsyncSession, Depends(get_db)]

SUPPORTED_LOCALES = ("en", "el")
DEFAULT_LOCALE = "en"


def get_locale(
    locale: str | None = Query(None, description="Explicit locale override, e.g. ?locale=el"),
    accept_language: str | None = Header(None),
) -> str:
    if locale and locale in SUPPORTED_LOCALES:
        return locale
    if accept_language:
        primary = accept_language.split(",")[0].split("-")[0].strip().lower()
        if primary in SUPPORTED_LOCALES:
            return primary
    return DEFAULT_LOCALE


Locale = Annotated[str, Depends(get_locale)]


def _extract_bearer_token(authorization: str | None, cookie_token: str | None) -> str | None:
    if authorization and authorization.lower().startswith("bearer "):
        return authorization[7:]
    return cookie_token


async def _resolve_user(
    db: AsyncSession,
    authorization: str | None,
    cookie_token: str | None,
    expected_role: Literal["user", "admin"],
):
    from app.modules.users.models import User  # local import avoids circular import at module load

    token = _extract_bearer_token(authorization, cookie_token)
    if not token:
        raise UnauthorizedError("Not authenticated.")
    try:
        payload = decode_access_token(token)
    except jwt.PyJWTError as exc:
        raise UnauthorizedError("Invalid or expired token.") from exc

    if payload.get("role") != expected_role:
        raise UnauthorizedError("Invalid or expired token.")

    user = await db.get(User, int(payload["sub"]))
    if user is None or not user.is_active:
        raise UnauthorizedError("Account not found or inactive.")
    return user


async def get_current_user(
    db: DbSession,
    authorization: str | None = Header(None),
    access_token: str | None = Cookie(None),
):
    return await _resolve_user(db, authorization, access_token, expected_role="user")


async def get_current_user_optional(
    db: DbSession,
    authorization: str | None = Header(None),
    access_token: str | None = Cookie(None),
):
    if not authorization and not access_token:
        return None
    try:
        return await _resolve_user(db, authorization, access_token, expected_role="user")
    except UnauthorizedError:
        return None


async def get_current_admin(
    db: DbSession,
    authorization: str | None = Header(None),
    admin_access_token: str | None = Cookie(None),
):
    admin = await _resolve_user(db, authorization, admin_access_token, expected_role="admin")
    if admin.role != "admin":
        raise ForbiddenError("Admin access required.")
    return admin


def rate_limit(key_prefix: str, max_attempts: int, window_seconds: int):
    """Fixed-window limiter keyed by client IP, via Redis INCR/EXPIRE.
    Attach as a route dependency, e.g.
    `Depends(rate_limit("login", max_attempts=10, window_seconds=60))`."""

    async def _dependency(request: Request) -> None:
        client_ip = request.client.host if request.client else "unknown"
        redis = get_redis()
        key = f"ratelimit:{key_prefix}:{client_ip}"
        count = await redis.incr(key)
        if count == 1:
            await redis.expire(key, window_seconds)
        if count > max_attempts:
            raise RateLimitedError("Too many attempts. Please try again later.")

    return _dependency
