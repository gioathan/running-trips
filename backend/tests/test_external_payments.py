import datetime

from sqlalchemy import text

from app.modules.bookings.models import Booking, BookingStatus
from app.modules.bookings.service import release_expired_pending_bookings
from app.modules.users.models import UserRole
from app.workers import tasks
from tests.conftest import bearer, booking_body, make_trip, make_user, use_fake_stripe

OFFICE_URL = "https://office.example/pay?ref={booking_id}"


async def _admin(db):
    return bearer(await make_user(db, email="admin@example.com", role=UserRole.admin))


async def _use_external(client, admin, **overrides):
    body = {"mode": "external", "external_url": OFFICE_URL, "external_hold_days": 3, **overrides}
    res = await client.put("/admin/payment-settings", json=body, headers=admin)
    assert res.status_code == 200, res.text


_booking_body = booking_body


async def test_settings_default_to_stripe_and_validate(client, db):
    admin = await _admin(db)
    assert (await client.get("/admin/payment-settings", headers=admin)).json()["mode"] == "stripe"

    no_link = await client.put("/admin/payment-settings", json={"mode": "external"}, headers=admin)
    assert no_link.status_code == 422
    bad_link = await client.put(
        "/admin/payment-settings", json={"mode": "external", "external_url": "javascript:alert(1)"}, headers=admin
    )
    assert bad_link.status_code == 422
    # The generic settings endpoint can't be used to skip that validation.
    bypass = await client.patch(
        "/admin/site-settings", json={"settings": {"payments": {"mode": "external"}}}, headers=admin
    )
    assert bypass.status_code == 422

    await _use_external(client, admin)
    assert (await client.get("/admin/payment-settings", headers=admin)).json() == {
        "mode": "external",
        "external_url": OFFICE_URL,
        "external_hold_days": 3,
    }
    assert (await client.get("/admin/payment-settings", headers=bearer(await make_user(db)))).status_code == 401


async def test_external_booking_is_recorded_and_points_to_the_link(client, db, enqueued):
    admin = await _admin(db)
    await _use_external(client, admin)
    trip = await make_trip(db, capacity=2)
    user = bearer(await make_user(db))

    res = await client.post("/bookings", json=_booking_body(trip, participants=2), headers=user)
    assert res.status_code == 200, res.text
    booking = res.json()
    assert booking["status"] == "awaiting_payment" and booking["payment_method"] == "external"
    assert booking["payment_url"] == f"https://office.example/pay?ref={booking['id']}"
    due = datetime.datetime.fromisoformat(booking["payment_due_at"]) - datetime.datetime.fromisoformat(booking["created_at"])
    assert due == datetime.timedelta(days=3)
    assert ("send_external_payment_instructions_email", {"booking_id": booking["id"]}) in enqueued

    # It holds its seats, shows up in My Trips, and can't go through Stripe.
    other = bearer(await make_user(db, email="other@example.com"))
    assert (await client.post("/bookings", json=_booking_body(trip), headers=other)).json()["code"] == "TRIP_FULL"
    mine = (await client.get("/users/me/bookings", headers=user)).json()
    assert mine["items"][0]["payment_url"] == booking["payment_url"]
    intent = await client.post("/payments/create-intent", json={"booking_id": booking["id"]}, headers=user)
    assert intent.status_code == 409


async def test_trip_link_overrides_default(client, db):
    admin = await _admin(db)
    await _use_external(client, admin)
    trip = await make_trip(db)
    res = await client.patch(
        f"/admin/trips/{trip.id}", json={"external_payment_url": "https://office.example/madrid"}, headers=admin
    )
    assert res.status_code == 200 and res.json()["external_payment_url"] == "https://office.example/madrid"
    bad = await client.patch(f"/admin/trips/{trip.id}", json={"external_payment_url": "not a url"}, headers=admin)
    assert bad.status_code == 422

    booking = (await client.post("/bookings", json=_booking_body(trip), headers=bearer(await make_user(db)))).json()
    assert booking["payment_url"] == "https://office.example/madrid"
    # The link is never exposed on the public trip endpoints.
    assert "external_payment_url" not in (await client.get(f"/trips/{trip.slug}")).json()


async def test_admin_confirms_or_refunds_external_booking(client, db, enqueued):
    admin = await _admin(db)
    await _use_external(client, admin)
    trip = await make_trip(db)
    user = bearer(await make_user(db))
    booking_id = (await client.post("/bookings", json=_booking_body(trip), headers=user)).json()["id"]
    enqueued.clear()

    confirmed = await client.patch(f"/admin/bookings/{booking_id}", json={"status": "confirmed"}, headers=admin)
    assert confirmed.status_code == 200 and confirmed.json()["payment_url"] is None
    assert enqueued == [("send_booking_confirmation_email", {"booking_id": booking_id})]

    # Saving the same status again doesn't re-send the email.
    await client.patch(f"/admin/bookings/{booking_id}", json={"status": "confirmed"}, headers=admin)
    assert len(enqueued) == 1
    # No Stripe payment behind it, so a refund is recorded by hand.
    refunded = await client.patch(f"/admin/bookings/{booking_id}", json={"status": "refunded"}, headers=admin)
    assert refunded.status_code == 200


async def test_unpaid_external_booking_expires_after_hold_days(client, db):
    admin = await _admin(db)
    await _use_external(client, admin, external_hold_days=3)
    trip = await make_trip(db, capacity=5)

    async def book(email, age_days):
        res = await client.post("/bookings", json=_booking_body(trip), headers=bearer(await make_user(db, email=email)))
        past = datetime.datetime.now(datetime.UTC) - datetime.timedelta(days=age_days)
        await db.execute(
            text("UPDATE bookings SET created_at = :t, updated_at = :t WHERE id = :id"), {"t": past, "id": res.json()["id"]}
        )
        await db.commit()
        return res.json()["id"]

    recent, overdue = await book("a@example.com", 2), await book("b@example.com", 4)
    assert await release_expired_pending_bookings(db) == 1
    db.expire_all()
    assert (await db.get(Booking, recent)).status == BookingStatus.awaiting_payment
    assert (await db.get(Booking, overdue)).status == BookingStatus.cancelled


async def test_switching_back_to_stripe_only_affects_new_bookings(client, db, monkeypatch):
    use_fake_stripe(monkeypatch)
    admin = await _admin(db)
    await _use_external(client, admin)
    trip = await make_trip(db)
    user = bearer(await make_user(db))
    external_id = (await client.post("/bookings", json=_booking_body(trip), headers=user)).json()["id"]

    res = await client.put("/admin/payment-settings", json={"mode": "stripe", "external_url": OFFICE_URL}, headers=admin)
    assert res.status_code == 200

    other = bearer(await make_user(db, email="other@example.com"))
    stripe_booking = (await client.post("/bookings", json=_booking_body(trip), headers=other)).json()
    assert stripe_booking["status"] == "pending" and stripe_booking["payment_method"] == "stripe"
    assert stripe_booking["payment_url"] is None
    assert (await client.post("/payments/create-intent", json={"booking_id": stripe_booking["id"]}, headers=other)).status_code == 200

    # The earlier external booking keeps its link and its days-long hold.
    earlier = (await client.get(f"/bookings/{external_id}", headers=user)).json()
    assert earlier["payment_method"] == "external" and earlier["payment_url"]
    assert await release_expired_pending_bookings(db) == 0


async def test_payment_instructions_email(client, db, monkeypatch):
    admin = await _admin(db)
    await _use_external(client, admin)
    trip = await make_trip(db)
    greek_user = await make_user(db, locale="el")
    booking_id = (await client.post("/bookings", json=_booking_body(trip), headers=bearer(greek_user))).json()["id"]

    sent = []
    monkeypatch.setattr(tasks, "send_email", lambda to, subject, html: sent.append((to, subject, html)))
    await tasks.send_external_payment_instructions_email({}, booking_id=booking_id)
    to, subject, body = sent[0]
    assert to == "booker@example.com" and "Μαδρίτη 10K" in subject  # the booking's contact email, not the account's
    assert f"https://office.example/pay?ref={booking_id}" in body and f"#{booking_id}" in body
