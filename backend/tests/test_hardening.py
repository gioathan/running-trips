import pytest
from redis.exceptions import ConnectionError as RedisConnectionError

from app.core import ratelimit
from app.core.config import get_settings
from app.core.redis import get_redis
from app.modules.users.models import UserRole
from tests.conftest import bearer, make_user

PASSWORD = "Runner-12345!"
TRUSTED = {"X-Proxy-Secret": "test-proxy-secret"}


def _from(ip):
    return {**TRUSTED, "X-Client-IP": ip}


async def test_rate_limited_response_says_when_to_retry(client, db):
    await make_user(db)
    body = {"email": "runner@example.com", "password": "wrong"}
    for _ in range(10):
        await client.post("/auth/login", json=body, headers=_from("198.51.100.1"))
    res = await client.post("/auth/login", json=body, headers=_from("198.51.100.1"))
    assert res.status_code == 429
    assert 1 <= int(res.headers["retry-after"]) <= 60


async def test_rate_limit_counters_always_expire(client):
    await client.post("/newsletter/subscribe", json={"email": "a@example.com"})
    redis = get_redis()
    keys = [k async for k in redis.scan_iter("ratelimit:*")]
    assert keys and all([await redis.ttl(k) > 0 for k in keys])


async def test_account_is_paused_after_repeated_failures_from_many_ips(client, db):
    await make_user(db)
    wrong = {"email": "Runner@Example.com", "password": "wrong"}
    for i in range(ratelimit.LOGIN_FAILURE_LIMIT):
        # A different IP every time — the per-IP limit never triggers.
        res = await client.post("/auth/login", json=wrong, headers=_from(f"203.0.113.{i}"))
        assert res.status_code == 401
    right = {"email": "runner@example.com", "password": PASSWORD}
    paused = await client.post("/auth/login", json=right, headers=_from("203.0.113.200"))
    assert paused.status_code == 429 and "retry-after" in paused.headers
    # Other accounts are unaffected.
    await make_user(db, email="other@example.com")
    other = await client.post("/auth/login", json={"email": "other@example.com", "password": PASSWORD}, headers=_from("203.0.113.201"))
    assert other.status_code == 200


async def test_successful_login_resets_the_failure_count(client, db):
    await make_user(db)
    for i in range(ratelimit.LOGIN_FAILURE_LIMIT - 1):
        await client.post("/auth/login", json={"email": "runner@example.com", "password": "wrong"}, headers=_from(f"203.0.113.{i}"))
    ok = await client.post("/auth/login", json={"email": "runner@example.com", "password": PASSWORD}, headers=_from("203.0.113.99"))
    assert ok.status_code == 200
    again = await client.post("/auth/login", json={"email": "runner@example.com", "password": "wrong"}, headers=_from("203.0.113.100"))
    assert again.status_code == 401  # counter restarted, not paused


async def test_admin_login_has_the_same_account_throttle(client, db):
    await make_user(db, email="admin@example.com", role=UserRole.admin)
    for i in range(ratelimit.LOGIN_FAILURE_LIMIT):
        await client.post("/admin/auth/login", json={"email": "admin@example.com", "password": "wrong"}, headers=_from(f"203.0.113.{i}"))
    res = await client.post("/admin/auth/login", json={"email": "admin@example.com", "password": PASSWORD}, headers=_from("203.0.113.250"))
    assert res.status_code == 429


async def test_global_ceiling_per_client_but_not_for_the_frontend_server(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "global_rate_limit_per_minute", 5)
    for _ in range(5):
        assert (await client.get("/trips", headers=_from("198.51.100.9"))).status_code == 200
    blocked = await client.get("/trips", headers=_from("198.51.100.9"))
    assert blocked.status_code == 429 and blocked.json()["code"] == "RATE_LIMITED" and "retry-after" in blocked.headers
    # Another visitor, the frontend's own (cached) server-side fetches, and
    # health checks are not affected.
    assert (await client.get("/trips", headers=_from("198.51.100.10"))).status_code == 200
    for _ in range(10):
        assert (await client.get("/trips", headers=TRUSTED)).status_code == 200
        assert (await client.get("/health", headers=_from("198.51.100.9"))).status_code == 200


async def test_limiters_fail_open_when_redis_is_down(client, db, monkeypatch):
    await make_user(db)

    class Down:
        def pipeline(self, *a, **k):
            raise RedisConnectionError("down")

        async def get(self, *a, **k):
            raise RedisConnectionError("down")

        async def delete(self, *a, **k):
            raise RedisConnectionError("down")

    monkeypatch.setattr(ratelimit, "get_redis", lambda: Down())
    res = await client.post("/auth/login", json={"email": "runner@example.com", "password": PASSWORD})
    assert res.status_code == 200


async def test_oversized_body_is_rejected(client):
    res = await client.post("/auth/login", content=b"x" * 1_100_000, headers={"Content-Type": "application/json"})
    assert res.status_code == 413 and res.json()["code"] == "PAYLOAD_TOO_LARGE"


async def test_security_headers_and_private_responses_not_cacheable(client, db):
    public = await client.get("/trips")
    assert public.headers["x-content-type-options"] == "nosniff"
    assert public.headers["x-frame-options"] == "DENY"
    assert "cache-control" not in public.headers  # public catalogue: the frontend caches it on purpose

    me = await client.get("/users/me", headers=bearer(await make_user(db)))
    assert me.headers["cache-control"] == "no-store"
    assert (await client.post("/auth/login", json={"email": "x@example.com", "password": "x"})).headers["cache-control"] == "no-store"


async def test_api_docs_are_off_outside_local_dev(client):
    # The test suite runs with ENVIRONMENT=test.
    for path in ("/docs", "/redoc", "/openapi.json"):
        assert (await client.get(path)).status_code == 404


@pytest.mark.parametrize("path", ["/auth/refresh", "/auth/verify-email", "/newsletter/unsubscribe"])
async def test_token_endpoints_are_rate_limited(client, path):
    field = "refresh_token" if path == "/auth/refresh" else "token"
    codes = {(await client.post(path, json={field: "bogus"})).status_code for _ in range(61)}
    assert 429 in codes
