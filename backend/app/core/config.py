from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_PLACEHOLDER_SECRET_KEYS = {"insecure-dev-key", "change-me-to-a-random-64-char-value"}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: str = "local"
    secret_key: str = "insecure-dev-key"
    frontend_origin: str = "http://localhost:3000"
    # Shared with the Next.js server (BACKEND_PROXY_SECRET there). When a
    # request carries it, the backend trusts its X-Client-IP header as the
    # end user's IP — otherwise every proxied request would look like it came
    # from the frontend server, collapsing per-IP rate limits into one bucket.
    proxy_shared_secret: str | None = None
    # Same value as REVALIDATE_SECRET in the frontend's env. When set, admin
    # content writes trigger on-demand ISR revalidation on the frontend
    # (FRONTEND_ORIGIN/api/revalidate) instead of waiting out the ISR window.
    revalidate_secret: str | None = None
    # Ceiling on requests per minute from one client IP across the whole API
    # (core/hardening.py). Unset = 300 everywhere except local dev, where it
    # is off: the dev frontend has no proxy secret, so every request would
    # share one bucket. Set to 0 to disable.
    global_rate_limit_per_minute: int | None = None
    max_request_body_bytes: int = 1_048_576

    database_url: str = "postgresql+asyncpg://runtrips:runtrips@localhost:5432/runtrips"
    redis_url: str = "redis://localhost:6379/0"

    access_token_ttl_minutes: int = 15
    refresh_token_ttl_days: int = 30
    refresh_token_ttl_days_remember_me: int = 90
    admin_access_token_ttl_minutes: int = 15
    admin_refresh_token_ttl_days: int = 7
    google_oauth_client_id: str | None = None

    resend_api_key: str | None = None
    # Resend Audience that newsletter subscribers are synced into (broadcasts
    # are sent from Resend's dashboard). Sync is skipped when unset.
    resend_audience_id: str | None = None
    email_from: str = "ΑΛΛΟΥ <no-reply@example.com>"

    stripe_secret_key: str | None = None
    stripe_webhook_secret: str | None = None

    r2_account_id: str | None = None
    r2_access_key_id: str | None = None
    r2_secret_access_key: str | None = None
    r2_bucket_name: str = "running-trips"
    r2_public_base_url: str = "https://media.example.com"

    @model_validator(mode="after")
    def _require_real_secret_outside_local(self) -> "Settings":
        # The JWT signing key — a default/placeholder value outside local dev
        # would let anyone mint admin tokens. Fail at startup instead.
        if self.environment != "local" and (
            self.secret_key in _PLACEHOLDER_SECRET_KEYS or len(self.secret_key) < 32
        ):
            raise ValueError("SECRET_KEY must be set to a random value of at least 32 characters outside local dev.")
        # Without it the backend can't tell end users apart behind the
        # frontend server, so every per-IP rate limit collapses into one
        # shared bucket — fail at startup rather than degrade silently.
        if self.environment != "local" and not self.proxy_shared_secret:
            raise ValueError("PROXY_SHARED_SECRET must be set outside local dev (same value as the frontend's BACKEND_PROXY_SECRET).")
        return self

    @property
    def effective_global_rate_limit(self) -> int:
        if self.global_rate_limit_per_minute is not None:
            return self.global_rate_limit_per_minute
        return 0 if self.environment == "local" else 300

    @property
    def r2_endpoint_url(self) -> str | None:
        if not self.r2_account_id:
            return None
        return f"https://{self.r2_account_id}.r2.cloudflarestorage.com"


@lru_cache
def get_settings() -> Settings:
    return Settings()
