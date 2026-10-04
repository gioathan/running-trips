from app.modules.bookings.models import BookingStatus
from app.modules.users.models import UserRole
from tests.conftest import bearer, make_booking, make_trip, make_user


async def test_participant_comments_are_public_and_moderatable(client, db):
    trip = await make_trip(db, starts_in_days=-10)  # ended
    runner = await make_user(db)
    runner.full_name = "Maria Papadopoulou"
    await db.commit()
    await make_booking(db, runner, trip, status=BookingStatus.confirmed)
    stranger = await make_user(db, email="stranger@example.com")

    ok = await client.post("/trip-comments", json={"trip_id": trip.id, "body": "Great race!"}, headers=bearer(runner))
    assert ok.status_code == 200, ok.text
    denied = await client.post("/trip-comments", json={"trip_id": trip.id, "body": "spam"}, headers=bearer(stranger))
    assert denied.status_code == 403

    public = (await client.get(f"/trips/{trip.slug}/comments")).json()
    assert public["total"] == 1
    assert public["items"][0]["author_name"] == "Maria"  # first name only
    assert "email" not in public["items"][0]

    admin = bearer(await make_user(db, email="admin@example.com", role=UserRole.admin))
    listing = (await client.get("/admin/trip-comments", headers=admin)).json()
    assert listing["items"][0]["user_email"] == "runner@example.com"
    assert (await client.delete(f"/admin/trip-comments/{listing['items'][0]['id']}", headers=admin)).status_code == 204
    assert (await client.get(f"/trips/{trip.slug}/comments")).json()["total"] == 0
