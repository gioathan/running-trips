"""Test harness: real Postgres + Redis, no mocked ORM (BACKEND_PLAN.md §9).

Point TEST_DATABASE_URL at a throwaway database — it's migrated from
scratch (downgrade base → upgrade head) and truncated between tests. With
docker compose:

    docker compose exec postgres createdb -U runtrips runtrips_test
    docker compose exec \
        -e TEST_DATABASE_URL=postgresql+asyncpg://runtrips:runtrips@postgres:5432/runtrips_test \
        -e TEST_REDIS_URL=redis://redis:6379/15 \
        api pytest
"""

import datetime
import inspect
import os
import subprocess
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")
if not TEST_DATABASE_URL:
    raise RuntimeError("Set TEST_DATABASE_URL to a throwaway Postgres database (see tests/conftest.py).")

# Must happen before anything imports app.core.config (settings are cached
# at import) — and explicitly blank every third-party key so a real value in
# backend/.env can never be used from a test run.
os.environ.update(
    {
        "ENVIRONMENT": "test",
        "SECRET_KEY": "test-secret-key-test-secret-key-test-secret",
        "DATABASE_URL": TEST_DATABASE_URL,
        "REDIS_URL": os.environ.get("TEST_REDIS_URL", "redis://localhost:6379/15"),
        "PROXY_SHARED_SECRET": "test-proxy-secret",
        "STRIPE_SECRET_KEY": "",
        "STRIPE_WEBHOOK_SECRET": "",
        "RESEND_API_KEY": "",
        "RESEND_AUDIENCE_ID": "",
        "REVALIDATE_SECRET": "",
        "GOOGLE_OAUTH_CLIENT_ID": "",
        # Storage: no account → nothing can reach a real bucket; fixed public
        # URL so tests don't depend on (or read) the developer's own .env.
        "R2_ACCOUNT_ID": "",
        "R2_ACCESS_KEY_ID": "",
        "R2_SECRET_ACCESS_KEY": "",
        "R2_BUCKET_NAME": "test-bucket",
        "R2_PUBLIC_BASE_URL": "https://media.example.com",
        "EMAIL_FROM": "Test <no-reply@example.com>",
    }
)

import httpx  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app.core.redis import get_redis  # noqa: E402
from app.core.security import create_access_token, hash_password  # noqa: E402
from app.db.session import AsyncSessionLocal  # noqa: E402
from app.main import app  # noqa: E402
from app.modules.bookings.models import Booking, BookingParticipant, BookingStatus  # noqa: E402
from app.modules.race_categories.models import RaceCategory, RaceCategoryTranslation  # noqa: E402
from app.modules.trips.models import Trip, TripCategory, TripStatus, TripTranslation  # noqa: E402
from app.modules.users.models import User, UserRole  # noqa: E402
from app.workers import enqueue  # noqa: E402

BACKEND_DIR = Path(__file__).resolve().parent.parent


def pytest_collection_modifyitems(items):
    # One event loop for the whole run: the app's engine/Redis client are
    # module-level singletons whose connections are bound to the loop that
    # created them.
    # Prepended so it takes precedence over the plain marker asyncio_mode=auto adds.
    marker = pytest.mark.asyncio(loop_scope="session")
    for item in items:
        if isinstance(item, pytest.Function) and inspect.iscoroutinefunction(item.function):
            item.add_marker(marker, append=False)


@pytest.fixture(scope="session", autouse=True)
def _migrated_database():
    # Subprocess because alembic's env.py runs its own event loop. Going
    # down to base first also exercises every migration's downgrade.
    for args in (["downgrade", "base"], ["upgrade", "head"]):
        subprocess.run([sys.executable, "-m", "alembic", *args], cwd=BACKEND_DIR, env=os.environ, check=True)


@pytest.fixture(autouse=True)
async def _clean_state():
    async with AsyncSessionLocal() as session:
        tables = (
            await session.execute(
                text("SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'alembic_version'")
            )
        ).scalars().all()
        await session.execute(text(f"TRUNCATE {', '.join(tables)} RESTART IDENTITY CASCADE"))
        await session.commit()
    await get_redis().flushdb()


@pytest.fixture(autouse=True)
def enqueued(monkeypatch) -> list[tuple[str, dict]]:
    """Background jobs requested during the test, as (task_name, kwargs)."""
    jobs: list[tuple[str, dict]] = []

    class _FakePool:
        async def enqueue_job(self, name, **kwargs):
            jobs.append((name, kwargs))

    async def _get_pool():
        return _FakePool()

    monkeypatch.setattr(enqueue, "_get_pool", _get_pool)
    return jobs


@pytest.fixture
async def client():
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest.fixture
async def db():
    async with AsyncSessionLocal() as session:
        yield session


def bearer(user: User) -> dict[str, str]:
    token = create_access_token(user.id, user.role, datetime.timedelta(minutes=15))
    return {"Authorization": f"Bearer {token}"}


async def make_user(db, email="runner@example.com", password="Runner-12345!", role=UserRole.user, locale="en") -> User:
    user = User(
        email=email, password_hash=hash_password(password), full_name="Test", role=role, locale=locale, email_verified=True
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def make_race_category(db, slug="10km") -> RaceCategory:
    category = RaceCategory(slug=slug)
    category.translations = [
        RaceCategoryTranslation(locale="en", name=slug),
        RaceCategoryTranslation(locale="el", name=slug),
    ]
    db.add(category)
    await db.commit()
    await db.refresh(category)
    return category


async def make_trip(
    db,
    slug="madrid-10k",
    capacity: int | None = 10,
    category_capacity: int | None = None,
    price: float = 100.0,
    starts_in_days: int = 30,
    is_full_override: bool = False,
    race_category: RaceCategory | None = None,
) -> Trip:
    race_category = race_category or await make_race_category(db, slug=f"{slug}-cat")
    start = datetime.date.today() + datetime.timedelta(days=starts_in_days)
    trip = Trip(
        slug=slug,
        start_date=start,
        end_date=start + datetime.timedelta(days=2),
        capacity=capacity,
        is_full_override=is_full_override,
        status=TripStatus.published,
    )
    trip.translations = [
        TripTranslation(locale="en", title="Madrid 10K"),
        TripTranslation(locale="el", title="Μαδρίτη 10K"),
    ]
    trip.categories = [TripCategory(race_category_id=race_category.id, price=price, capacity=category_capacity)]
    db.add(trip)
    await db.commit()
    await db.refresh(trip)
    return trip


async def make_booking(db, user: User, trip: Trip, status=BookingStatus.confirmed, participants=1) -> Booking:
    booking = Booking(
        user_id=user.id,
        trip_id=trip.id,
        trip_category_id=trip.categories[0].id,
        status=status,
        participant_count=participants,
        total_amount_cents=10000 * participants,
    )
    booking.participants = [BookingParticipant(full_name=f"P{i}") for i in range(participants)]
    db.add(booking)
    await db.commit()
    await db.refresh(booking)
    return booking


def fake_intent(intent_id="pi_test_1"):
    return SimpleNamespace(id=intent_id, client_secret=f"{intent_id}_secret")


def use_fake_stripe(monkeypatch) -> None:
    """Payments enabled (a key is set) but no call ever reaches Stripe."""
    from app.core.config import get_settings
    from app.modules.payments import stripe_client

    monkeypatch.setattr(get_settings(), "stripe_secret_key", "sk_test_dummy")
    monkeypatch.setattr(stripe_client, "create_payment_intent", lambda *a, **k: fake_intent())


def booking_body(trip: Trip, participants: int | list[dict] = 1, **overrides) -> dict:
    """A valid POST /bookings payload. `participants` is a head count, or
    the participant dicts themselves."""
    if isinstance(participants, int):
        participants = [
            {"full_name": f"Runner Number{chr(65 + i)}", "date_of_birth": "1990-05-17", "gender": "female"}
            for i in range(participants)
        ]
    return {
        "trip_id": trip.id,
        "trip_category_id": trip.categories[0].id,
        "contact_email": "booker@example.com",
        "contact_phone": "+306912345678",
        "participants": participants,
        **overrides,
    }
