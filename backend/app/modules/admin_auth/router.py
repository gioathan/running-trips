from fastapi import APIRouter, Depends, Request

from app.core.dependencies import DbSession, get_current_admin, rate_limit
from app.modules.admin_auth import service
from app.modules.admin_auth.schemas import (
    AdminAuthResponse,
    AdminLoginRequest,
    AdminRefreshRequest,
    AdminUserPublic,
    TokenPair,
)
from app.modules.users.models import User

router = APIRouter(prefix="/admin/auth", tags=["admin-auth"])


def _client_meta(request: Request) -> tuple[str | None, str | None]:
    return request.headers.get("user-agent"), (request.client.host if request.client else None)


@router.post(
    "/login",
    response_model=AdminAuthResponse,
    dependencies=[Depends(rate_limit("admin-login", max_attempts=5, window_seconds=60))],
)
async def admin_login(body: AdminLoginRequest, request: Request, db: DbSession):
    admin = await service.authenticate_admin(db, body.email, body.password)
    user_agent, ip = _client_meta(request)
    access_token, refresh_token = await service.issue_admin_tokens(db, admin, user_agent, ip)
    return AdminAuthResponse(
        user=AdminUserPublic.model_validate(admin), tokens=TokenPair(access_token=access_token, refresh_token=refresh_token)
    )


@router.post("/refresh", response_model=TokenPair)
async def admin_refresh(body: AdminRefreshRequest, request: Request, db: DbSession):
    user_agent, ip = _client_meta(request)
    access_token, refresh_token, _ = await service.rotate_admin_refresh_token(db, body.refresh_token, user_agent, ip)
    return TokenPair(access_token=access_token, refresh_token=refresh_token)


@router.post("/logout", status_code=204)
async def admin_logout(body: AdminRefreshRequest, db: DbSession):
    await service.revoke_admin_refresh_token(db, body.refresh_token)


@router.get("/me", response_model=AdminUserPublic)
async def admin_me(current_admin: User = Depends(get_current_admin)):
    return AdminUserPublic.model_validate(current_admin)
