import datetime
import hashlib
import secrets

import jwt
from passlib.context import CryptContext

from app.core.config import get_settings

settings = get_settings()

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

JWT_ALGORITHM = "HS256"


def hash_password(raw_password: str) -> str:
    return pwd_context.hash(raw_password)


def verify_password(raw_password: str, password_hash: str) -> bool:
    return pwd_context.verify(raw_password, password_hash)


def _encode(claims: dict, ttl: datetime.timedelta) -> str:
    now = datetime.datetime.now(datetime.UTC)
    payload = {**claims, "iat": now, "exp": now + ttl}
    return jwt.encode(payload, settings.secret_key, algorithm=JWT_ALGORITHM)


def _decode(token: str) -> dict:
    return jwt.decode(token, settings.secret_key, algorithms=[JWT_ALGORITHM])


def create_access_token(user_id: int, role: str, ttl: datetime.timedelta) -> str:
    return _encode({"sub": str(user_id), "role": role, "type": "access"}, ttl)


def decode_access_token(token: str) -> dict:
    payload = _decode(token)
    if payload.get("type") != "access":
        raise jwt.InvalidTokenError("wrong token type")
    return payload


def create_purpose_token(user_id: int, purpose: str, ttl: datetime.timedelta) -> str:
    """Signed, expiring, single-purpose token for email links (verify-email,
    reset-password) — not a session token, so it carries a `purpose` claim
    that must match on decode."""
    return _encode({"sub": str(user_id), "purpose": purpose, "type": "purpose"}, ttl)


def create_email_purpose_token(email: str, purpose: str, ttl: datetime.timedelta) -> str:
    """Like `create_purpose_token`, but the subject is an email address
    rather than a user id — for flows with no account attached, e.g.
    newsletter unsubscribe links."""
    return _encode({"sub": email, "purpose": purpose, "type": "purpose"}, ttl)


def decode_purpose_token(token: str, expected_purpose: str) -> dict:
    payload = _decode(token)
    if payload.get("type") != "purpose" or payload.get("purpose") != expected_purpose:
        raise jwt.InvalidTokenError("wrong token purpose")
    return payload


def generate_opaque_token() -> tuple[str, str]:
    """Returns (raw_token_to_send_to_client, sha256_hash_to_store_in_db).
    Used for refresh tokens — high-entropy random values, so a fast hash
    (not argon2) is fine and keeps refresh-token lookups cheap."""
    raw = secrets.token_urlsafe(48)
    return raw, hash_opaque_token(raw)


def hash_opaque_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode()).hexdigest()
