from tests.conftest import bearer, make_user


async def test_profile_details_round_trip(client, db):
    headers = bearer(await make_user(db))

    saved = await client.patch("/users/me", json={"full_name": "Maria Papadopoulou", "phone": "+306912345678"}, headers=headers)
    assert saved.status_code == 200
    me = (await client.get("/users/me", headers=headers)).json()
    assert (me["full_name"], me["phone"]) == ("Maria Papadopoulou", "+306912345678")

    # Changing one field leaves the others alone.
    await client.patch("/users/me", json={"full_name": "Maria P."}, headers=headers)
    me = (await client.get("/users/me", headers=headers)).json()
    assert (me["full_name"], me["phone"]) == ("Maria P.", "+306912345678")

    profile = {
        "date_of_birth": "1990-05-17",
        "nationality": "Greek",
        "shirt_size": "M",
        "emergency_contact_name": "Nikos",
        "emergency_contact_phone": "+306987654321",
    }
    assert (await client.patch("/users/me/travel-profile", json=profile, headers=headers)).status_code == 200
    stored = (await client.get("/users/me/travel-profile", headers=headers)).json()
    assert {k: stored[k] for k in profile} == profile


async def test_emptied_profile_fields_are_saved_as_not_set(client, db):
    headers = bearer(await make_user(db))
    await client.patch("/users/me", json={"phone": "+306912345678"}, headers=headers)
    await client.patch("/users/me/travel-profile", json={"nationality": "Greek", "shirt_size": "M"}, headers=headers)

    assert (await client.patch("/users/me", json={"phone": "  "}, headers=headers)).json()["phone"] is None
    cleared = await client.patch("/users/me/travel-profile", json={"nationality": "", "shirt_size": ""}, headers=headers)
    assert (cleared.json()["nationality"], cleared.json()["shirt_size"]) == (None, None)


async def test_too_long_profile_values_are_rejected_not_a_server_error(client, db):
    headers = bearer(await make_user(db))
    too_long = [
        ("/users/me", {"full_name": "x" * 256}),
        ("/users/me", {"phone": "1" * 51}),
        ("/users/me/travel-profile", {"shirt_size": "extra large"}),
        ("/users/me/travel-profile", {"nationality": "x" * 101}),
        ("/users/me/travel-profile", {"emergency_contact_phone": "1" * 51}),
    ]
    for path, body in too_long:
        res = await client.patch(path, json=body, headers=headers)
        assert res.status_code == 422, (path, body, res.status_code)

    # "No extras" must not hit the NOT NULL column either.
    assert (await client.patch("/users/me/travel-profile", json={"extra": None}, headers=headers)).status_code == 200


async def test_profile_needs_a_session(client):
    assert (await client.get("/users/me")).status_code == 401
    assert (await client.patch("/users/me", json={"full_name": "x"})).status_code == 401
    assert (await client.patch("/users/me/travel-profile", json={"shirt_size": "M"})).status_code == 401
