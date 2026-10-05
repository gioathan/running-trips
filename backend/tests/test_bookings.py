import datetime

from sqlalchemy import select, text

from app.modules.bookings.models import Booking, BookingStatus
from app.modules.bookings.service import release_expired_pending_bookings
from app.modules.payments import stripe_client
from app.modules.payments.models import Payment, PaymentStatus
from tests.conftest import bearer, booking_body, make_booking, make_trip, make_user, use_fake_stripe


_booking_body = booking_body


async def test_booking_respects_capacity_including_held_seats(client, db):
    trip = await make_trip(db, capacity=2)
    other = await make_user(db, email="other@example.com")
    await make_booking(db, other, trip, status=BookingStatus.awaiting_payment)
    user = await make_user(db)

    ok = await client.post("/bookings", json=_booking_body(trip), headers=bearer(user))
    assert ok.status_code == 200, ok.text
    full = await client.post("/bookings", json=_booking_body(trip), headers=bearer(await make_user(db, email="x@example.com")))
    assert full.status_code == 409 and full.json()["code"] == "TRIP_FULL"

    listing = (await client.get("/trips")).json()
    assert listing["items"][0]["is_full"] is True


async def test_full_override_and_started_trips_are_not_bookable(client, db):
    user = await make_user(db)
    full = await make_trip(db, slug="full", is_full_override=True)
    started = await make_trip(db, slug="started", starts_in_days=-1)

    res = await client.post("/bookings", json=_booking_body(full), headers=bearer(user))
    assert res.json()["code"] == "TRIP_FULL"
    res = await client.post("/bookings", json=_booking_body(started), headers=bearer(user))
    assert res.json()["code"] == "TRIP_NOT_BOOKABLE"


async def test_retrying_checkout_cancels_own_unpaid_pending_booking(client, db):
    trip = await make_trip(db, capacity=1)
    user = await make_user(db)

    first = await client.post("/bookings", json=_booking_body(trip), headers=bearer(user))
    second = await client.post("/bookings", json=_booking_body(trip), headers=bearer(user))
    assert first.status_code == 200 and second.status_code == 200, second.text

    statuses = {b.id: b.status for b in (await db.execute(select(Booking))).scalars()}
    assert statuses == {first.json()["id"]: BookingStatus.cancelled, second.json()["id"]: BookingStatus.pending}


async def _age(db, booking_id, minutes):
    # Raw SQL so updated_at's ORM onupdate doesn't reset it to now().
    past = datetime.datetime.now(datetime.UTC) - datetime.timedelta(minutes=minutes)
    await db.execute(
        text("UPDATE bookings SET created_at = :t, updated_at = :t WHERE id = :id"), {"t": past, "id": booking_id}
    )
    await db.commit()


async def test_expiry_releases_pending_and_abandoned_payment_bookings(client, db, monkeypatch):
    use_fake_stripe(monkeypatch)
    cancelled_intents = []
    monkeypatch.setattr(stripe_client, "cancel_payment_intent", lambda i: cancelled_intents.append(i) or True)

    trip = await make_trip(db, capacity=5)
    user = await make_user(db)
    stale_pending_id = (await make_booking(db, user, trip, status=BookingStatus.pending)).id
    fresh_pending_id = (
        await make_booking(db, await make_user(db, email="b@example.com"), trip, status=BookingStatus.pending)
    ).id
    payer = bearer(await make_user(db, email="c@example.com"))
    abandoned_id = (await client.post("/bookings", json=_booking_body(trip), headers=payer)).json()["id"]
    intent = await client.post("/payments/create-intent", json={"booking_id": abandoned_id}, headers=payer)
    assert intent.status_code == 200, intent.text

    await _age(db, stale_pending_id, 31)
    await _age(db, abandoned_id, 61)
    assert await release_expired_pending_bookings(db) == 2

    db.expire_all()
    assert (await db.get(Booking, stale_pending_id)).status == BookingStatus.cancelled
    assert (await db.get(Booking, fresh_pending_id)).status == BookingStatus.pending
    assert (await db.get(Booking, abandoned_id)).status == BookingStatus.cancelled
    payment = (await db.execute(select(Payment))).scalar_one()
    assert payment.status == PaymentStatus.failed
    assert cancelled_intents == ["pi_test_1"]


async def test_expiry_leaves_booking_if_stripe_refuses_cancel(client, db, monkeypatch):
    use_fake_stripe(monkeypatch)
    monkeypatch.setattr(stripe_client, "cancel_payment_intent", lambda i: False)  # already paid/processing

    trip = await make_trip(db)
    user = await make_user(db)
    booking = (await client.post("/bookings", json=_booking_body(trip), headers=bearer(user))).json()
    await client.post("/payments/create-intent", json={"booking_id": booking["id"]}, headers=bearer(user))
    await _age(db, booking["id"], 61)

    assert await release_expired_pending_bookings(db) == 0
    db.expire_all()
    assert (await db.get(Booking, booking["id"])).status == BookingStatus.awaiting_payment
