import pytest

from app.modules.bookings.models import Booking, BookingStatus
from app.modules.payments import stripe_client
from app.modules.trips.models import Trip, TripImage
from app.modules.uploads import service as uploads_service
from app.modules.users.models import UserRole
from tests.conftest import bearer, booking_body, make_booking, make_trip, make_user, use_fake_stripe

MEDIA = "https://media.example.com"  # the default R2_PUBLIC_BASE_URL


@pytest.fixture
def bucket(monkeypatch):
    """Stands in for the storage bucket: records which files get deleted."""
    deleted: list[str] = []

    def delete_objects(urls):
        deleted.extend(urls)
        return len(urls)

    monkeypatch.setattr(uploads_service, "delete_objects", delete_objects)
    return deleted


async def _admin(db):
    return bearer(await make_user(db, email="admin@example.com", role=UserRole.admin))


async def _with_photos(db, trip, *names, cover=None):
    trip.cover_image_url = cover
    for i, name in enumerate(names):
        db.add(TripImage(trip_id=trip.id, url=name, sort_order=i))
    await db.commit()
    await db.refresh(trip)


async def test_trip_without_bookings_is_removed_with_its_photos(client, db, bucket):
    admin = await _admin(db)
    trip = await make_trip(db)
    await _with_photos(db, trip, f"{MEDIA}/2026/10/a.jpg", "https://picsum.photos/seed/x/800", cover=f"{MEDIA}/2026/10/cover.jpg")

    trip_id = trip.id

    preview = (await client.get(f"/admin/trips/{trip_id}/deletion-preview", headers=admin)).json()
    assert preview == {"bookings_kept": 0, "bookings_paid": 0, "bookings_to_cancel": 0, "photos": 2}

    res = await client.delete(f"/admin/trips/{trip_id}", headers=admin)
    assert res.status_code == 200, res.text
    assert res.json() == {"outcome": "removed", "bookings_kept": 0, "bookings_cancelled": 0, "photos_deleted": 2}
    # Only our own files are deleted — never an image hosted somewhere else.
    assert sorted(bucket) == [f"{MEDIA}/2026/10/a.jpg", f"{MEDIA}/2026/10/cover.jpg"]
    db.expire_all()
    assert await db.get(Trip, trip_id) is None


async def test_upcoming_trip_with_bookings_keeps_records_and_cancels_unpaid(client, db, bucket, monkeypatch):
    use_fake_stripe(monkeypatch)
    cancelled_intents = []
    monkeypatch.setattr(stripe_client, "cancel_payment_intent", lambda ref: cancelled_intents.append(ref) or True)
    admin = await _admin(db)
    trip = await make_trip(db, slug="madrid-10k", capacity=10)
    await _with_photos(db, trip, f"{MEDIA}/2026/10/a.jpg", cover=f"{MEDIA}/2026/10/cover.jpg")

    paid_user = await make_user(db, email="paid@example.com")
    paid = await make_booking(db, paid_user, trip, status=BookingStatus.confirmed)
    pending = await make_booking(db, await make_user(db, email="pending@example.com"), trip, status=BookingStatus.pending)
    payer = bearer(await make_user(db, email="midpay@example.com"))
    awaiting_id = (await client.post("/bookings", json=booking_body(trip), headers=payer)).json()["id"]
    assert (await client.post("/payments/create-intent", json={"booking_id": awaiting_id}, headers=payer)).status_code == 200
    paid_id, pending_id, trip_id, new_booking = paid.id, pending.id, trip.id, booking_body(trip)
    paid_headers = bearer(paid_user)

    preview = (await client.get(f"/admin/trips/{trip_id}/deletion-preview", headers=admin)).json()
    assert preview == {"bookings_kept": 1, "bookings_paid": 1, "bookings_to_cancel": 2, "photos": 2}

    res = await client.delete(f"/admin/trips/{trip_id}", headers=admin)
    assert res.status_code == 200, res.text
    assert res.json() == {"outcome": "hidden", "bookings_kept": 3, "bookings_cancelled": 2, "photos_deleted": 2}
    assert cancelled_intents == ["pi_test_1"]  # nobody can still pay for it

    db.expire_all()
    assert (await db.get(Booking, paid_id)).status == BookingStatus.confirmed  # paid booking untouched
    assert (await db.get(Booking, pending_id)).status == BookingStatus.cancelled
    assert (await db.get(Booking, awaiting_id)).status == BookingStatus.cancelled

    # Gone from the site and the admin list…
    assert (await client.get("/trips/madrid-10k")).status_code == 404
    assert (await client.get("/trips")).json()["total"] == 0
    assert (await client.get("/admin/trips", headers=admin)).json()["total"] == 0
    assert (await client.get(f"/admin/trips/{trip_id}", headers=admin)).status_code == 404
    assert (await client.delete(f"/admin/trips/{trip_id}", headers=admin)).status_code == 404
    # …but the customer and the admin still see the booking, labelled as a deleted trip.
    mine = (await client.get("/users/me/bookings", headers=paid_headers)).json()["items"][0]
    assert mine["trip"]["deleted"] is True and mine["trip"]["title"] == "Madrid 10K" and mine["trip"]["cover_image_url"] is None
    listed = (await client.get("/admin/bookings", headers=admin)).json()
    assert listed["total"] == 3 and all(b["trip"]["deleted"] for b in listed["items"])
    # No new bookings, and the slug is free for a new trip.
    again = await client.post("/bookings", json=new_booking, headers=paid_headers)
    assert again.status_code == 404
    reused = await client.post(
        "/admin/trips",
        headers=admin,
        json={"slug": "madrid-10k", "start_date": "2027-05-01", "end_date": "2027-05-03", "translations": [{"locale": "en", "title": "Madrid again"}]},
    )
    assert reused.status_code == 200, reused.text


async def test_shared_photo_is_not_deleted_while_another_trip_uses_it(client, db, bucket):
    admin = await _admin(db)
    shared = f"{MEDIA}/2026/10/shared.jpg"
    first, second = await make_trip(db, slug="first"), await make_trip(db, slug="second")
    await _with_photos(db, first, shared, f"{MEDIA}/2026/10/only-first.jpg")
    await _with_photos(db, second, cover=shared)

    res = await client.delete(f"/admin/trips/{first.id}", headers=admin)
    assert res.json()["photos_deleted"] == 1 and bucket == [f"{MEDIA}/2026/10/only-first.jpg"]

    # Once the last trip using it goes, the file goes too.
    await client.delete(f"/admin/trips/{second.id}", headers=admin)
    assert shared in bucket


async def test_removing_or_replacing_a_photo_deletes_its_file(client, db, bucket):
    admin = await _admin(db)
    trip = await make_trip(db)
    await _with_photos(db, trip, f"{MEDIA}/2026/10/a.jpg", cover=f"{MEDIA}/2026/10/old-cover.jpg")
    image_id = (await client.get(f"/admin/trips/{trip.id}", headers=admin)).json()["images"][0]["id"]

    assert (await client.delete(f"/admin/trips/{trip.id}/images/{image_id}", headers=admin)).status_code == 204
    assert bucket == [f"{MEDIA}/2026/10/a.jpg"]

    res = await client.patch(f"/admin/trips/{trip.id}", json={"cover_image_url": f"{MEDIA}/2026/10/new-cover.jpg"}, headers=admin)
    assert res.status_code == 200
    assert bucket == [f"{MEDIA}/2026/10/a.jpg", f"{MEDIA}/2026/10/old-cover.jpg"]
    # Saving again without changing the cover deletes nothing.
    await client.patch(f"/admin/trips/{trip.id}", json={"capacity": 5}, headers=admin)
    assert len(bucket) == 2


def test_only_our_own_media_urls_map_to_bucket_files():
    assert uploads_service.object_key_for(f"{MEDIA}/2026/10/a.jpg") == "2026/10/a.jpg"
    assert uploads_service.object_key_for(f"{MEDIA}/2026/10/a.jpg?v=2") == "2026/10/a.jpg"
    assert uploads_service.object_key_for("https://picsum.photos/seed/x/800") is None
    assert uploads_service.object_key_for("https://media.example.com.evil.test/a.jpg") is None
    assert uploads_service.object_key_for(None) is None
