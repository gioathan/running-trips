import pytest

from app.core.redis import get_redis
from app.modules.bookings.models import Booking, BookingStatus
from app.modules.payments import service as payments_service
from app.modules.payments import stripe_client
from app.modules.payments.models import Payment, PaymentStatus
from tests.conftest import bearer, booking_body, make_trip, make_user, use_fake_stripe


@pytest.fixture
def stripe_events(monkeypatch):
    """Feed webhook events directly, bypassing signature verification."""
    use_fake_stripe(monkeypatch)
    pending: dict = {}
    monkeypatch.setattr(stripe_client, "construct_webhook_event", lambda payload, sig: pending["event"])

    async def send(client, event_id, event_type, intent_id="pi_test_1"):
        pending["event"] = {"id": event_id, "type": event_type, "data": {"object": {"id": intent_id}}}
        return await client.post("/payments/webhook", content=b"{}", headers={"stripe-signature": "t=1,v1=x"})

    return send


async def _checkout(client, db):
    trip = await make_trip(db)
    user = await make_user(db)
    booking = (
        await client.post(
            "/bookings",
            json=booking_body(trip),
            headers=bearer(user),
        )
    ).json()
    res = await client.post("/payments/create-intent", json={"booking_id": booking["id"]}, headers=bearer(user))
    assert res.status_code == 200, res.text
    return booking["id"]


async def test_success_confirms_once_and_dedupes_retries(client, db, stripe_events, enqueued):
    booking_id = await _checkout(client, db)

    assert (await stripe_events(client, "evt_1", "payment_intent.succeeded")).status_code == 204
    assert (await stripe_events(client, "evt_1", "payment_intent.succeeded")).status_code == 204

    db.expire_all()
    assert (await db.get(Booking, booking_id)).status == BookingStatus.confirmed
    assert enqueued.count(("send_booking_confirmation_email", {"booking_id": booking_id})) == 1


async def test_payment_for_cancelled_booking_does_not_resurrect_it(client, db, stripe_events, enqueued):
    booking_id = await _checkout(client, db)
    booking = await db.get(Booking, booking_id)
    booking.status = BookingStatus.cancelled
    await db.commit()

    await stripe_events(client, "evt_2", "payment_intent.succeeded")

    db.expire_all()
    assert (await db.get(Booking, booking_id)).status == BookingStatus.cancelled
    payment = await db.get(Payment, 1)
    assert payment.status == PaymentStatus.succeeded  # visible to admin for a refund
    assert not enqueued


async def test_failed_processing_is_retried_not_swallowed(client, db, stripe_events, monkeypatch):
    booking_id = await _checkout(client, db)
    original = payments_service._apply_intent_event

    async def boom(*args, **kwargs):
        raise RuntimeError("db went away")

    monkeypatch.setattr(payments_service, "_apply_intent_event", boom)
    with pytest.raises(RuntimeError):
        await stripe_events(client, "evt_3", "payment_intent.succeeded")
    assert not await get_redis().exists("stripe-event:evt_3")

    monkeypatch.setattr(payments_service, "_apply_intent_event", original)
    await stripe_events(client, "evt_3", "payment_intent.succeeded")  # Stripe's retry
    db.expire_all()
    assert (await db.get(Booking, booking_id)).status == BookingStatus.confirmed


async def test_failure_event_does_not_override_success(client, db, stripe_events):
    await _checkout(client, db)
    await stripe_events(client, "evt_4", "payment_intent.succeeded")
    await stripe_events(client, "evt_5", "payment_intent.payment_failed")
    db.expire_all()
    assert (await db.get(Payment, 1)).status == PaymentStatus.succeeded


async def test_admin_lists_and_refunds_payments(client, db, stripe_events, monkeypatch):
    from app.modules.users.models import UserRole

    admin = bearer(await make_user(db, email="admin@example.com", role=UserRole.admin))
    booking_id = await _checkout(client, db)

    # Not paid yet → not refundable.
    assert (await client.post("/admin/payments/1/refund", headers=admin)).status_code == 409

    await stripe_events(client, "evt_6", "payment_intent.succeeded")
    listing = (await client.get("/admin/payments?status=succeeded", headers=admin)).json()
    assert listing["total"] == 1
    assert listing["items"][0]["user_email"] == "runner@example.com"
    assert listing["items"][0]["trip_title"] == "Madrid 10K"

    refunded_intents = []
    monkeypatch.setattr(stripe_client, "refund_payment_intent", refunded_intents.append)
    res = await client.post("/admin/payments/1/refund", headers=admin)
    assert res.status_code == 200, res.text
    assert res.json()["status"] == "refunded" and res.json()["booking_status"] == "refunded"
    assert refunded_intents == ["pi_test_1"]

    db.expire_all()
    assert (await db.get(Booking, booking_id)).status == BookingStatus.refunded
    # Refunding twice is rejected rather than hitting Stripe again.
    assert (await client.post("/admin/payments/1/refund", headers=admin)).status_code == 409


async def test_create_intent_without_stripe_key_is_a_clear_503(client, db):
    trip = await make_trip(db)
    user = await make_user(db)
    booking = await client.post(
        "/bookings",
        json=booking_body(trip),
        headers=bearer(user),
    )
    res = await client.post("/payments/create-intent", json={"booking_id": booking.json()["id"]}, headers=bearer(user))
    assert res.status_code == 503 and res.json()["code"] == "SERVICE_NOT_CONFIGURED"
