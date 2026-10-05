from app.modules.users.models import UserRole
from tests.conftest import bearer, make_booking, make_race_category, make_trip, make_user


async def _admin(db):
    return bearer(await make_user(db, email="admin@example.com", role=UserRole.admin))


async def test_editing_trip_with_bookings_keeps_category_rows(client, db):
    headers = await _admin(db)
    trip = await make_trip(db)
    category = trip.categories[0]
    await make_booking(db, await make_user(db), trip)
    extra = await make_race_category(db, slug="5km")

    res = await client.patch(
        f"/admin/trips/{trip.id}",
        headers=headers,
        json={
            "capacity": 20,
            "categories": [
                {"id": category.id, "race_category_id": category.race_category_id, "price": 150, "capacity": 5},
                {"race_category_id": extra.id, "price": 80},
            ],
        },
    )
    assert res.status_code == 200, res.text
    categories = {c["id"]: c for c in res.json()["categories"]}
    assert categories[category.id]["price"] == 150  # updated in place, same id
    assert len(categories) == 2


async def test_removing_booked_category_is_a_conflict(client, db):
    headers = await _admin(db)
    trip = await make_trip(db)
    await make_booking(db, await make_user(db), trip)

    res = await client.patch(f"/admin/trips/{trip.id}", headers=headers, json={"categories": []})
    assert res.status_code == 409


async def test_deleting_category_in_use_is_a_conflict(client, db):
    headers = await _admin(db)
    trip = await make_trip(db)
    await make_booking(db, await make_user(db), trip)

    category_id = trip.categories[0].race_category_id
    assert (await client.delete(f"/admin/race-categories/{category_id}", headers=headers)).status_code == 409


async def test_deleting_unbooked_trip_works(client, db):
    headers = await _admin(db)
    trip = await make_trip(db)
    res = await client.delete(f"/admin/trips/{trip.id}", headers=headers)
    assert res.status_code == 200 and res.json()["outcome"] == "removed"


async def test_presign_rejects_non_images_and_reports_unconfigured_storage(client, db):
    headers = await _admin(db)
    bad = await client.post("/admin/uploads/presign", headers=headers, json={"filename": "x.html", "content_type": "text/html"})
    assert bad.status_code == 422
    # R2 isn't configured in tests — a clear 503, not a 500.
    ok_type = await client.post("/admin/uploads/presign", headers=headers, json={"filename": "x.jpg", "content_type": "image/jpeg"})
    assert ok_type.status_code == 503 and ok_type.json()["code"] == "STORAGE_NOT_CONFIGURED"


async def test_content_writes_request_one_coalesced_revalidation(client, db, enqueued, monkeypatch):
    from app.core.config import get_settings

    headers = await _admin(db)
    trip = await make_trip(db)

    # Off unless REVALIDATE_SECRET is configured.
    await client.patch(f"/admin/trips/{trip.id}", headers=headers, json={"capacity": 11})
    assert not enqueued

    monkeypatch.setattr(get_settings(), "revalidate_secret", "s")
    await client.patch(f"/admin/trips/{trip.id}", headers=headers, json={"capacity": 12})
    await client.get("/admin/trips", headers=headers)  # reads never trigger it
    await client.patch("/admin/bookings/999", headers=headers, json={"status": "confirmed"})  # not public content
    await client.delete(f"/admin/trips/{trip.id + 100}", headers=headers)  # failed writes don't either

    assert len(enqueued) == 1 and enqueued[0][0] == "revalidate_frontend"
    assert enqueued[0][1]["_job_id"].startswith("revalidate-frontend:") and enqueued[0][1]["_defer_by"] == 3


def test_revalidation_job_ids_coalesce_a_burst_but_not_later_saves():
    from app.core.revalidation import revalidation_job_id

    # Same few seconds → one job. A later save → a new id, so the queue
    # doesn't discard it as a duplicate of the earlier, finished job.
    assert revalidation_job_id(1000.0) == revalidation_job_id(1001.5)
    assert revalidation_job_id(1000.0) != revalidation_job_id(1010.0)


async def test_admin_writes_are_audited(client, db):
    from sqlalchemy import select

    from app.modules.audit.models import AuditLog

    headers = await _admin(db)
    created = await client.post(
        "/admin/race-categories",
        headers=headers,
        json={"slug": "marathon", "translations": [{"locale": "en", "name": "Marathon"}]},
    )
    assert created.status_code == 200, created.text
    trip = await make_trip(db)
    await client.post(f"/admin/trips/{trip.id}/images", headers=headers, json={"url": "https://x/y.jpg"})

    rows = (await db.execute(select(AuditLog.entity_type, AuditLog.action).order_by(AuditLog.id))).all()
    assert rows == [("race_category", "create"), ("trip_image", "create")]
