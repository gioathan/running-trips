"""Cross-cutting protections applied to every request: request-size cap, a
global per-client rate ceiling, and response security headers."""

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.core.ratelimit import client_ip, hit, presents_proxy_secret

# Not counted against the global ceiling: liveness probes, and Stripe's
# webhook deliveries (signature-verified; throttling them delays bookings).
RATE_LIMIT_EXEMPT_PATHS = ("/health", "/payments/webhook")

# Responses under these prefixes are per-user or per-admin. `no-store` keeps
# any cache between the API and its caller (CDN, proxy, browser) from ever
# holding them. Public catalogue reads are left alone — the Next.js server
# caches those deliberately.
PRIVATE_PATH_PREFIXES = ("/auth", "/admin", "/users", "/bookings", "/payments", "/contact", "/trip-comments")

SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    # The API serves JSON only — nothing it returns should load anything.
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
}


def _error(status_code: int, code: str, message: str, headers: dict | None = None) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"code": code, "message": message, "details": {}}, headers=headers)


def _is_trusted_server_call(request: Request) -> bool:
    """A Server Component fetch from the Next.js server itself (shared
    secret, no end-user IP attached). Those are cached, low-volume, and all
    arrive from the frontend host's IP — counting them per IP would put
    every visitor in one bucket."""
    return presents_proxy_secret(request) and not request.headers.get("x-client-ip")


def register_hardening(app: FastAPI) -> None:
    settings = get_settings()

    @app.middleware("http")
    async def _harden(request: Request, call_next):
        # Largest legitimate body is a CMS page save (tens of KB). Uploads go
        # straight to object storage, never through the API. Chunked bodies
        # without a Content-Length are capped by the reverse proxy (Caddyfile).
        declared = request.headers.get("content-length")
        if declared and declared.isdigit() and int(declared) > settings.max_request_body_bytes:
            return _error(413, "PAYLOAD_TOO_LARGE", "Request body is too large.")

        limit = settings.effective_global_rate_limit
        if limit and not request.url.path.startswith(RATE_LIMIT_EXEMPT_PATHS) and not _is_trusted_server_call(request):
            count, retry_after = await hit(f"ratelimit:global:{client_ip(request)}", 60)
            if count > limit:
                return _error(
                    429, "RATE_LIMITED", "Too many requests. Please slow down.", {"Retry-After": str(retry_after)}
                )

        response = await call_next(request)

        for name, value in SECURITY_HEADERS.items():
            response.headers.setdefault(name, value)
        is_private = (
            request.method != "GET"
            or "authorization" in request.headers
            or request.url.path.startswith(PRIVATE_PATH_PREFIXES)
        )
        if is_private:
            response.headers.setdefault("Cache-Control", "no-store")
        return response
