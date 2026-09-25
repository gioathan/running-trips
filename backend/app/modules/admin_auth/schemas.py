from pydantic import BaseModel, EmailStr, ConfigDict


class AdminLoginRequest(BaseModel):
    email: EmailStr
    password: str


class AdminRefreshRequest(BaseModel):
    refresh_token: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class AdminUserPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: str | None
    role: str


class AdminAuthResponse(BaseModel):
    user: AdminUserPublic
    tokens: TokenPair
