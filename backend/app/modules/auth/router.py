from fastapi import APIRouter, Depends, Request

from app.core.dependencies import DbSession, rate_limit
from app.modules.auth import service
from app.modules.auth.schemas import (
    AuthResponse,
    ForgotPasswordRequest,
    GoogleLoginRequest,
    LoginRequest,
    RefreshRequest,
    ResetPasswordRequest,
    SignupRequest,
    TokenPair,
    UserPublic,
    VerifyEmailRequest,
)
from app.workers.enqueue import enqueue_email

router = APIRouter(prefix="/auth", tags=["auth"])


def _client_meta(request: Request) -> tuple[str | None, str | None]:
    return request.headers.get("user-agent"), (request.client.host if request.client else None)


@router.post("/signup", response_model=AuthResponse)
async def signup(body: SignupRequest, request: Request, db: DbSession):
    user = await service.signup(db, body.email, body.password, body.full_name, body.locale)
    await enqueue_email("send_verification_email", user_id=user.id)
    user_agent, ip = _client_meta(request)
    access_token, refresh_token = await service.issue_tokens(db, user, False, user_agent, ip)
    return AuthResponse(user=UserPublic.model_validate(user), tokens=TokenPair(access_token=access_token, refresh_token=refresh_token))


@router.post(
    "/login",
    response_model=AuthResponse,
    dependencies=[Depends(rate_limit("login", max_attempts=10, window_seconds=60))],
)
async def login(body: LoginRequest, request: Request, db: DbSession):
    user = await service.authenticate(db, body.email, body.password)
    user_agent, ip = _client_meta(request)
    access_token, refresh_token = await service.issue_tokens(db, user, body.remember_me, user_agent, ip)
    return AuthResponse(user=UserPublic.model_validate(user), tokens=TokenPair(access_token=access_token, refresh_token=refresh_token))


@router.post("/google", response_model=AuthResponse)
async def google_login(body: GoogleLoginRequest, request: Request, db: DbSession):
    user = await service.login_or_signup_with_google(db, body.id_token, body.locale)
    user_agent, ip = _client_meta(request)
    access_token, refresh_token = await service.issue_tokens(db, user, True, user_agent, ip)
    return AuthResponse(user=UserPublic.model_validate(user), tokens=TokenPair(access_token=access_token, refresh_token=refresh_token))


@router.post("/refresh", response_model=TokenPair)
async def refresh(body: RefreshRequest, request: Request, db: DbSession):
    user_agent, ip = _client_meta(request)
    access_token, refresh_token, _ = await service.rotate_refresh_token(db, body.refresh_token, user_agent, ip)
    return TokenPair(access_token=access_token, refresh_token=refresh_token)


@router.post("/logout", status_code=204)
async def logout(body: RefreshRequest, db: DbSession):
    await service.revoke_refresh_token(db, body.refresh_token)


@router.post("/verify-email", response_model=UserPublic)
async def verify_email(body: VerifyEmailRequest, db: DbSession):
    user = await service.verify_email(db, body.token)
    return UserPublic.model_validate(user)


@router.post(
    "/forgot-password",
    status_code=204,
    dependencies=[Depends(rate_limit("forgot-password", max_attempts=5, window_seconds=300))],
)
async def forgot_password(body: ForgotPasswordRequest, db: DbSession):
    user = await service.get_user_by_email(db, body.email)
    if user:
        await enqueue_email("send_password_reset_email", user_id=user.id)
    # Always 204 regardless of whether the email exists — don't leak account existence.


@router.post("/reset-password", response_model=UserPublic)
async def reset_password(body: ResetPasswordRequest, db: DbSession):
    user = await service.reset_password(db, body.token, body.new_password)
    return UserPublic.model_validate(user)
