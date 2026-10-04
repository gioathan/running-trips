from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.core.security import is_strong_password

_PASSWORD_ERROR = "Password must be at least 10 characters and include an uppercase letter, a lowercase letter, a number, and a symbol."


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=10, max_length=128)
    full_name: str | None = None
    locale: str = "en"

    @field_validator("password")
    @classmethod
    def _validate_password_strength(cls, value: str) -> str:
        if not is_strong_password(value):
            raise ValueError(_PASSWORD_ERROR)
        return value


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    remember_me: bool = False


class GoogleLoginRequest(BaseModel):
    id_token: str
    locale: str = "en"


class RefreshRequest(BaseModel):
    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=10, max_length=128)

    @field_validator("new_password")
    @classmethod
    def _validate_password_strength(cls, value: str) -> str:
        if not is_strong_password(value):
            raise ValueError(_PASSWORD_ERROR)
        return value


class VerifyEmailRequest(BaseModel):
    token: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    # Echoed on /auth/refresh so the frontend can keep the refresh cookie's
    # lifetime in line with what was chosen at login.
    remember_me: bool = False


class UserPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: str | None
    role: str
    locale: str
    email_verified: bool


class AuthResponse(BaseModel):
    user: UserPublic
    tokens: TokenPair
