import asyncio
import time

from sqlalchemy import func, select

from app.modules.bookings.models import BookingStatus
from app.modules.payments import stripe_client
from app.modules.payments.models import Payment
from app.modules.trips.models import Trip, TripStatus
from app.modules.users.models import UserRole
from tests.conftest import bearer, fake_intent, make_booking, make_trip, make_user, use_fake_stripe


async def test_admin_cannot_sign_in_through_user_login(client, db):
    await make_user(db, email="admin@example.com", password="Admin-12345!", role=UserRole.admin)

    ok_password = await client.post("/auth/login", json={"email": "admin@example.com", "password": "Admin-12345!"})
    assert ok_password.status_code == 403 and ok_password.json()["code"] == "ADMIN_ACCOUNT"
    # Wrong password still looks like any other failed login — no hint it's an admin.
    wrong = await client.post("/auth/login", json={"email": "admin@example.com", "password": "nope"})
    assert wrong.status_code == 401 and wrong.json()["code"] == "INVALID_CREDENTIALS"


async def test_contact_rejects_unknown_trip_and_inquiry_type(client, db):
    headers = bearer(await make_user(db))
    unknown_trip = await client.post("/contact", json={"trip_id": 999, "message": "hi"}, headers=headers)
    assert unknown_trip.status_code == 404
    bad_type = await client.post("/contact", json={"inquiry_type": "spam", "message": "hi"}, headers=headers)
    assert bad_type.status_code == 422
    ok = await client.post("/contact", json={"inquiry_type": "general", "message": "hi"}, headers=headers)
    assert ok.status_code == 201


async def test_public_stats_ignore_drafts(client, db):
    await make_trip(db, slug="live")
    draft = await make_trip(db, slug="draft")
    draft.status = TripStatus.draft
    draft.location_country = "Nowhere"
    await db.commit()

    stats = (await client.get("/trips/stats")).json()
    assert stats["races_organized"] == 1


async def test_admin_cannot_mark_booking_refunded_by_hand(client, db):
    admin = bearer(await make_user(db, email="admin@example.com", role=UserRole.admin))
    trip = await make_trip(db)
    booking = await make_booking(db, await make_user(db), trip, status=BookingStatus.confirmed)

    res = await client.patch(f"/admin/bookings/{booking.id}", json={"status": "refunded"}, headers=admin)
    assert res.status_code == 409
    res = await client.patch(f"/admin/bookings/{booking.id}", json={"status": "cancelled"}, headers=admin)
    assert res.status_code == 200


async def test_double_clicked_checkout_creates_one_payment_intent(client, db, monkeypatch):
    use_fake_stripe(monkeypatch)
    created = []

    def slow_create(amount, metadata):
        time.sleep(0.2)  # a real Stripe round-trip; runs in a worker thread
        created.append(amount)
        return fake_intent(f"pi_{len(created)}")

    monkeypatch.setattr(stripe_client, "create_payment_intent", slow_create)
    monkeypatch.setattr(stripe_client.stripe.PaymentIntent, "retrieve", lambda ref: fake_intent(ref))

    trip = await make_trip(db)
    user = await make_user(db)
    booking = await make_booking(db, user, trip, status=BookingStatus.pending)

    first, second = await asyncio.gather(
        *[client.post("/payments/create-intent", json={"booking_id": booking.id}, headers=bearer(user)) for _ in range(2)]
    )
    assert first.status_code == 200 and second.status_code == 200, (first.text, second.text)
    assert first.json()["client_secret"] == second.json()["client_secret"]
    assert len(created) == 1
    assert (await db.execute(select(func.count(Payment.id)))).scalar_one() == 1
    assert await db.get(Trip, trip.id)  # sanity: nothing else disturbed
