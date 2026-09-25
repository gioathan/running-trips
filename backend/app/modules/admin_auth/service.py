import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import InvalidCredentialsError, UnauthorizedError
from app.core.security import create_access_token, generate_opaque_token, hash_opaque_token, verify_password
from app.modules.admin_auth.models import AdminRefreshToken
from app.modules.auth.service import get_user_by_email
from app.modules.users.models import User, UserRole

settings = get_settings()


async def authenticate_admin(db: AsyncSession, email: str, password: str) -> User:
    user = await get_user_by_email(db, email)
    if (
        user is None
        or user.role != UserRole.admin
        or user.password_hash is None
        or not verify_password(password, user.password_hash)
    ):
        raise InvalidCredentialsError("Incorrect email or password.")
    if not user.is_active:
        raise InvalidCredentialsError("Account is disabled.")
    return user


async def issue_admin_tokens(
    db: AsyncSession, admin: User, user_agent: str | None, ip: str | None
) -> tuple[str, str]:
    access_token = create_access_token(
        admin.id, UserRole.admin, datetime.timedelta(minutes=settings.admin_access_token_ttl_minutes)
    )
    raw_refresh, refresh_hash = generate_opaque_token()
    now = datetime.datetime.now(datetime.UTC)
    db.add(
        AdminRefreshToken(
            admin_user_id=admin.id,
            token_hash=refresh_hash,
            expires_at=now + datetime.timedelta(days=settings.admin_refresh_token_ttl_days),
            user_agent=user_agent,
            ip=ip,
            created_at=now,
        )
    )
    await db.commit()
    return access_token, raw_refresh


async def rotate_admin_refresh_token(
    db: AsyncSession, raw_refresh_token: str, user_agent: str | None, ip: str | None
) -> tuple[str, str, User]:
    token_hash = hash_opaque_token(raw_refresh_token)
    result = await db.execute(select(AdminRefreshToken).where(AdminRefreshToken.token_hash == token_hash))
    stored = result.scalar_one_or_none()
    now = datetime.datetime.now(datetime.UTC)
    if stored is None or stored.revoked_at is not None or stored.expires_at < now:
        raise UnauthorizedError("Refresh token is invalid or expired.")

    stored.revoked_at = now
    admin = await db.get(User, stored.admin_user_id)
    if admin is None or admin.role != UserRole.admin or not admin.is_active:
        raise UnauthorizedError("Account not found or inactive.")

    access_token, raw_refresh = await issue_admin_tokens(db, admin, user_agent, ip)
    return access_token, raw_refresh, admin


async def revoke_admin_refresh_token(db: AsyncSession, raw_refresh_token: str) -> None:
    token_hash = hash_opaque_token(raw_refresh_token)
    result = await db.execute(select(AdminRefreshToken).where(AdminRefreshToken.token_hash == token_hash))
    stored = result.scalar_one_or_none()
    if stored and stored.revoked_at is None:
        stored.revoked_at = datetime.datetime.now(datetime.UTC)
        await db.commit()
