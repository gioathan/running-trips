import pytest

from app.core.config import get_settings
from app.modules.auth import service as auth_service
from app.modules.auth.service import build_password_reset_token
from tests.conftest import make_user

PASSWORD = "Runner-12345!"


@pytest.fixture
def google(monkeypatch):
    """Sign in "with Google" as whoever the test says, without calling Google."""
    monkeypatch.setattr(get_settings(), "google_oauth_client_id", "test-client.apps.googleusercontent.com")
    monkeypatch.setattr(auth_service.settings, "google_oauth_client_id", "test-client.apps.googleusercontent.com")
    identity = {}
    monkeypatch.setattr(auth_service.google_id_token, "verify_oauth2_token", lambda *a, **k: dict(identity))

    def as_(email, sub="google-sub-1", verified=True):
        identity.update(sub=sub, email=email, email_verified=verified, name="Google Person")

    return as_


async def _google_login(client, intent="login"):
    return await client.post("/auth/google", json={"id_token": "x", "locale": "en", "intent": intent})


async def test_google_account_signs_in_with_google_only(client, db, google, enqueued):
    google("maria@example.com")
    first = await _google_login(client, intent="signup")
    assert first.status_code == 200, first.text
    assert (await _google_login(client)).status_code == 200  # returning Google user

    # The same person trying the password form is told to use Google…
    by_password = await client.post("/auth/login", json={"email": "maria@example.com", "password": PASSWORD})
    assert by_password.status_code == 409 and by_password.json()["code"] == "USE_GOOGLE_SIGN_IN"
    # …as is an attempt to register that email with a password.
    signup = await client.post("/auth/signup", json={"email": "maria@example.com", "password": PASSWORD, "full_name": "M"})
    assert signup.status_code == 409 and signup.json()["code"] == "USE_GOOGLE_SIGN_IN"

    # And "forgot password" can't be used to bolt a password onto it.
    enqueued.clear()
    assert (await client.post("/auth/forgot-password", json={"email": "maria@example.com"})).status_code == 204
    assert not enqueued


async def test_password_account_cannot_sign_in_with_google(client, db, google):
    user = await make_user(db)  # runner@example.com, registered with a password
    google("runner@example.com")
    res = await _google_login(client)
    assert res.status_code == 409 and res.json()["code"] == "USE_PASSWORD_SIGN_IN"

    # Nothing was linked: the password still works, and Google still doesn't.
    assert (await client.post("/auth/login", json={"email": "runner@example.com", "password": PASSWORD})).status_code == 200
    assert (await _google_login(client)).status_code == 409
    await db.refresh(user)
    assert user.password_hash is not None


async def test_reset_link_is_useless_for_a_google_only_account(client, db, google):
    google("maria@example.com")
    user_id = (await _google_login(client, intent="signup")).json()["user"]["id"]
    from app.modules.users.models import User

    token = build_password_reset_token(await db.get(User, user_id))
    res = await client.post("/auth/reset-password", json={"token": token, "new_password": "Brand-New-Pass1!"})
    assert res.status_code == 401


async def test_google_from_the_login_form_never_creates_an_account(client, db, google):
    from sqlalchemy import func, select

    from app.modules.users.models import User

    google("newcomer@example.com")
    res = await _google_login(client, intent="login")
    assert res.status_code == 404 and res.json()["code"] == "GOOGLE_ACCOUNT_NOT_REGISTERED"
    # Leaving the intent out behaves like "login" — creating accounts is opt-in.
    assert (await client.post("/auth/google", json={"id_token": "x"})).status_code == 404
    assert (await db.execute(select(func.count(User.id)))).scalar_one() == 0

    # The sign-up form creates it; after that both forms sign the person in.
    created = await _google_login(client, intent="signup")
    assert created.status_code == 200 and created.json()["user"]["email"] == "newcomer@example.com"
    assert (await _google_login(client, intent="login")).status_code == 200
    assert (await _google_login(client, intent="signup")).status_code == 200
    assert (await db.execute(select(func.count(User.id)))).scalar_one() == 1


async def test_password_account_is_refused_from_either_google_button(client, db, google):
    await make_user(db)
    google("runner@example.com")
    for intent in ("login", "signup"):
        res = await _google_login(client, intent=intent)
        assert res.status_code == 409 and res.json()["code"] == "USE_PASSWORD_SIGN_IN"
