import pytest

from app.modules.bookings.models import BookingStatus
from app.modules.users.models import UserRole
from app.workers import tasks
from tests.conftest import bearer, booking_body, make_trip, make_user


def _participant(**overrides):
    return {"full_name": "Maria Papadopoulou", "date_of_birth": "1990-05-17", "gender": "female", **overrides}


@pytest.mark.parametrize(
    "overrides",
    [
        {"participants": [_participant(full_name="Μαρία Παπαδοπούλου")]},  # not Latin
        {"participants": [_participant(full_name="Maria")]},  # no surname
        {"participants": [_participant(full_name="Maria P4padopoulou")]},
        {"participants": [_participant(date_of_birth="2999-01-01")]},
        {"participants": [_participant(gender="unknown")]},
        {"participants": [_participant(shirt_size="HUGE")]},
        {"participants": [{"full_name": "Maria Papadopoulou"}]},  # date of birth + gender are required
        {"participants": []},
        {"contact_phone": "6912345678"},  # no country code
        {"contact_phone": "+30 69"},  # too short
        {"contact_phone": ""},
        {"contact_email": "not-an-email"},
        {"emergency_contact_phone": "12345"},
    ],
)
async def test_invalid_booking_details_are_rejected(client, db, overrides):
    trip = await make_trip(db)
    user = bearer(await make_user(db))
    res = await client.post("/bookings", json=booking_body(trip, **overrides), headers=user)
    assert res.status_code == 422, res.text


async def test_booking_stores_normalized_contact_and_participant_details(client, db):
    trip = await make_trip(db)
    user = bearer(await make_user(db))
    body = booking_body(
        trip,
        contact_email="Other.Person@Example.com",
        contact_phone="+30 691 234 5678",
        emergency_contact_name="  Nikos  ",
        emergency_contact_phone="+44 (20) 7946-0958",
        participants=[
            _participant(full_name="  José   O'Neill-Müller ", nationality="Spanish", shirt_size="L"),
            _participant(full_name="Anna Smith", gender="other", nationality="", shirt_size=""),
        ],
    )
    res = await client.post("/bookings", json=body, headers=user)
    assert res.status_code == 200, res.text
    booking = res.json()
    assert booking["contact_email"] == "other.person@example.com"
    assert booking["contact_phone"] == "+306912345678"
    assert booking["emergency_contact_name"] == "Nikos"
    assert booking["emergency_contact_phone"] == "+442079460958"
    first, second = booking["participants"]
    assert first["full_name"] == "José O'Neill-Müller" and first["shirt_size"] == "L"
    assert first["date_of_birth"] == "1990-05-17" and first["gender"] == "female"
    assert second["nationality"] is None and second["shirt_size"] is None
    assert "passport_number" not in first

    admin = bearer(await make_user(db, email="admin@example.com", role=UserRole.admin))
    listed = (await client.get("/admin/bookings", headers=admin)).json()["items"][0]
    assert listed["contact_phone"] == "+306912345678" and len(listed["participants"]) == 2


async def test_booking_emails_go_to_the_booking_contact_email(client, db, monkeypatch):
    trip = await make_trip(db)
    user = bearer(await make_user(db))
    booking_id = (await client.post("/bookings", json=booking_body(trip, contact_email="other@example.com"), headers=user)).json()["id"]

    sent = []
    monkeypatch.setattr(tasks, "send_email", lambda to, subject, html: sent.append(to))
    await tasks.send_booking_confirmation_email({}, booking_id=booking_id)
    assert sent == ["other@example.com"]


async def test_older_bookings_without_details_still_read(client, db):
    from tests.conftest import make_booking

    trip = await make_trip(db)
    account = await make_user(db)
    await make_booking(db, account, trip, status=BookingStatus.confirmed)  # no contact fields, like pre-existing rows

    mine = (await client.get("/users/me/bookings", headers=bearer(account))).json()["items"][0]
    assert mine["contact_email"] is None and mine["participants"][0]["gender"] is None
