import datetime

from sqlalchemy import update

from app.modules.auth.service import build_password_reset_token
from app.modules.users.models import RefreshToken
from tests.conftest import make_user

PASSWORD = "Runner-12345!"


async def _login(client, remember_me=False, headers=None):
    res = await client.post(
        "/auth/login",
        json={"email": "runner@example.com", "password": PASSWORD, "remember_me": remember_me},
        headers=headers or {},
    )
    assert res.status_code == 200, res.text
    return res.json()["tokens"]


async def test_refresh_rotates_and_echoes_remember_me(client, db):
    await make_user(db)
    tokens = await _login(client, remember_me=True)

    res = await client.post("/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert res.status_code == 200
    body = res.json()
    assert body["refresh_token"] != tokens["refresh_token"]
    assert body["remember_me"] is True


async def test_rotated_token_reusable_only_within_grace_window(client, db):
    await make_user(db)
    tokens = await _login(client)

    first = await client.post("/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    # A parallel request carrying the same (now rotated) cookie still succeeds.
    second = await client.post("/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert first.status_code == 200 and second.status_code == 200

    long_ago = datetime.datetime.now(datetime.UTC) - datetime.timedelta(minutes=5)
    await db.execute(update(RefreshToken).values(rotated_at=long_ago, revoked_at=long_ago).where(RefreshToken.rotated_at.is_not(None)))
    await db.commit()
    third = await client.post("/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert third.status_code == 401


async def test_logged_out_token_is_never_reusable(client, db):
    await make_user(db)
    tokens = await _login(client)

    assert (await client.post("/auth/logout", json={"refresh_token": tokens["refresh_token"]})).status_code == 204
    res = await client.post("/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert res.status_code == 401


async def test_reset_link_is_single_use_and_revokes_sessions(client, db):
    user = await make_user(db)
    tokens = await _login(client)
    reset_token = build_password_reset_token(user)

    res = await client.post("/auth/reset-password", json={"token": reset_token, "new_password": "Brand-New-Pass1!"})
    assert res.status_code == 200, res.text

    reused = await client.post("/auth/reset-password", json={"token": reset_token, "new_password": "Another-Pass12!"})
    assert reused.status_code == 401

    refreshed = await client.post("/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert refreshed.status_code == 401


async def test_rate_limit_keys_on_forwarded_ip_only_with_secret(client, db):
    await make_user(db)
    bad_login = {"email": "runner@example.com", "password": "wrong-password", "remember_me": False}
    trusted = lambda ip: {"X-Client-IP": ip, "X-Proxy-Secret": "test-proxy-secret"}  # noqa: E731

    for _ in range(10):
        assert (await client.post("/auth/login", json=bad_login, headers=trusted("198.51.100.1"))).status_code == 401
    assert (await client.post("/auth/login", json=bad_login, headers=trusted("198.51.100.1"))).status_code == 429

    # A different end user behind the same proxy has their own bucket.
    assert (await client.post("/auth/login", json=bad_login, headers=trusted("198.51.100.2"))).status_code == 401

    # Without the secret the header is ignored, so it can't be used to dodge
    # limits — these all land on the socket peer's bucket.
    spoofed = {"X-Client-IP": "203.0.113.9", "X-Proxy-Secret": "wrong"}
    for _ in range(10):
        await client.post("/auth/login", json=bad_login, headers=spoofed)
    assert (await client.post("/auth/login", json=bad_login, headers={"X-Client-IP": "203.0.113.10"})).status_code == 429


async def test_admin_cannot_use_user_endpoints_and_vice_versa(client, db):
    from app.modules.users.models import UserRole
    from tests.conftest import bearer

    admin = await make_user(db, email="admin@example.com", role=UserRole.admin)
    user = await make_user(db, email="other@example.com")
    assert (await client.get("/users/me", headers=bearer(admin))).status_code == 401
    assert (await client.get("/admin/bookings", headers=bearer(user))).status_code == 401


async def test_weak_password_is_a_422_not_a_500(client):
    res = await client.post("/auth/signup", json={"email": "new@example.com", "password": "weakweakweak"})
    assert res.status_code == 422 and res.json()["code"] == "VALIDATION_ERROR"
