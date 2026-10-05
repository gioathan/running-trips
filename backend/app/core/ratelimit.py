"""Redis-backed rate limiting.

Three layers, all fixed-window counters:
- `rate_limit(...)`: per-endpoint, per-client-IP (route dependency).
- login failure throttle: per *account*, so a password can't be guessed from
  many IPs at once.
- a global per-IP ceiling for the whole API (see core/hardening.py).

If Redis is unreachable the limiters fail open (and log): a cache outage
shouldn't also take login and checkout down with it.
"""

import hashlib
import hmac
import logging

from fastapi import Request
from redis.exceptions import RedisError

from app.core.config import get_settings
from app.core.exceptions import InvalidCredentialsError, RateLimitedError
from app.core.redis import get_redis

logger = logging.getLogger(__name__)

# Per account: 20 wrong passwords in 15 minutes pauses further attempts on
# that account until the window ends. High enough that a typo-prone owner
# never notices, low enough to make guessing pointless (< 2,000/day).
LOGIN_FAILURE_LIMIT = 20
LOGIN_FAILURE_WINDOW_SECONDS = 15 * 60


def presents_proxy_secret(request: Request) -> bool:
    secret = get_settings().proxy_shared_secret
    presented = request.headers.get("x-proxy-secret")
    return bool(secret and presented and hmac.compare_digest(presented, secret))


def client_ip(request: Request) -> str:
    """The end user's IP. Requests relayed by the Next.js server carry the
    browser's IP in X-Client-IP, trusted only alongside the shared proxy
    secret; anything else falls back to the socket peer (which, in prod, is
    the real client — uvicorn runs with --proxy-headers behind Caddy)."""
    forwarded_ip = request.headers.get("x-client-ip")
    if forwarded_ip and presents_proxy_secret(request):
        return forwarded_ip.strip()
    return request.client.host if request.client else "unknown"


async def hit(key: str, window_seconds: int) -> tuple[int, int]:
    """Count one event against `key`. Returns (count in the current window,
    seconds until the window resets). Atomic: the key is created with its
    expiry in the same transaction as the increment, so a crash can never
    leave a counter without a TTL (which would block that client forever)."""
    try:
        async with get_redis().pipeline(transaction=True) as pipe:
            pipe.set(key, 0, ex=window_seconds, nx=True)
            pipe.incr(key)
            pipe.ttl(key)
            _, count, ttl = await pipe.execute()
        return int(count), max(int(ttl), 1)
    except RedisError:
        logger.exception("Rate limiter unavailable — failing open for %s", key)
        return 0, 0


def rate_limit(key_prefix: str, max_attempts: int, window_seconds: int):
    """Per-endpoint limiter keyed by client IP. Attach as a route dependency:
    `Depends(rate_limit("login", max_attempts=10, window_seconds=60))`."""

    async def _dependency(request: Request) -> None:
        count, retry_after = await hit(f"ratelimit:{key_prefix}:{client_ip(request)}", window_seconds)
        if count > max_attempts:
            raise RateLimitedError("Too many attempts. Please try again later.", retry_after=retry_after)

    return _dependency


def _login_failure_key(scope: str, email: str) -> str:
    # Hashed so email addresses don't sit in Redis key names.
    digest = hashlib.sha256(email.strip().lower().encode()).hexdigest()[:32]
    return f"loginfail:{scope}:{digest}"


async def ensure_login_not_throttled(scope: str, email: str) -> None:
    key = _login_failure_key(scope, email)
    try:
        redis = get_redis()
        failures = int(await redis.get(key) or 0)
        retry_after = max(int(await redis.ttl(key)), 1) if failures else 0
    except RedisError:
        logger.exception("Rate limiter unavailable — failing open for %s", key)
        return
    if failures >= LOGIN_FAILURE_LIMIT:
        raise RateLimitedError("Too many failed sign-in attempts. Please try again later.", retry_after=retry_after)


async def record_login_failure(scope: str, email: str) -> None:
    await hit(_login_failure_key(scope, email), LOGIN_FAILURE_WINDOW_SECONDS)


async def clear_login_failures(scope: str, email: str) -> None:
    try:
        await get_redis().delete(_login_failure_key(scope, email))
    except RedisError:
        logger.exception("Rate limiter unavailable — could not clear login failures")


async def throttled_login(scope: str, email: str, authenticate):
    """Run `authenticate()` under the per-account failure throttle: refuse
    while the account is paused, count a wrong password, reset on success."""
    await ensure_login_not_throttled(scope, email)
    try:
        user = await authenticate()
    except InvalidCredentialsError:
        await record_login_failure(scope, email)
        raise
    await clear_login_failures(scope, email)
    return user
