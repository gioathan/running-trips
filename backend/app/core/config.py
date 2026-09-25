from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: str = "local"
    secret_key: str = "insecure-dev-key"
    frontend_origin: str = "http://localhost:3000"

    database_url: str = "postgresql+asyncpg://runtrips:runtrips@localhost:5432/runtrips"
    redis_url: str = "redis://localhost:6379/0"

    access_token_ttl_minutes: int = 15
    refresh_token_ttl_days: int = 30
    refresh_token_ttl_days_remember_me: int = 90
    admin_access_token_ttl_minutes: int = 15
    admin_refresh_token_ttl_days: int = 7
    google_oauth_client_id: str | None = None

    resend_api_key: str | None = None
    email_from: str = "ΑΛΛΟΥ <no-reply@example.com>"

    stripe_secret_key: str | None = None
    stripe_webhook_secret: str | None = None

    r2_account_id: str | None = None
    r2_access_key_id: str | None = None
    r2_secret_access_key: str | None = None
    r2_bucket_name: str = "running-trips"
    r2_public_base_url: str = "https://media.example.com"

    @property
    def r2_endpoint_url(self) -> str | None:
        if not self.r2_account_id:
            return None
        return f"https://{self.r2_account_id}.r2.cloudflarestorage.com"


@lru_cache
def get_settings() -> Settings:
    return Settings()
