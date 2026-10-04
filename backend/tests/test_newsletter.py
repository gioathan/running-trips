import resend

from app.core.config import get_settings
from app.modules.newsletter.service import build_unsubscribe_token
from app.workers import tasks


async def test_subscribe_syncs_and_welcomes_once_unsubscribe_syncs(client, enqueued):
    body = {"email": "Fan@Example.com", "source": "footer", "locale": "el"}
    assert (await client.post("/newsletter/subscribe", json=body)).status_code == 204
    assert (await client.post("/newsletter/subscribe", json=body)).status_code == 204  # dedupe: no repeat jobs
    assert enqueued == [
        ("sync_newsletter_contact", {"email": "fan@example.com", "subscribed": True}),
        ("send_newsletter_welcome_email", {"email": "fan@example.com", "locale": "el"}),
    ]

    enqueued.clear()
    token = build_unsubscribe_token("fan@example.com")
    assert (await client.post("/newsletter/unsubscribe", json={"token": token})).status_code == 204
    assert (await client.post("/newsletter/unsubscribe", json={"token": token})).status_code == 204
    assert enqueued == [("sync_newsletter_contact", {"email": "fan@example.com", "subscribed": False})]


async def test_sync_task_updates_then_creates(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "resend_api_key", "re_test")
    monkeypatch.setattr(settings, "resend_audience_id", "aud_1")
    calls = []

    def update(params):
        calls.append(("update", params))
        raise resend.exceptions.ResendError(code=404, error_type="not_found", message="missing", suggested_action="")

    monkeypatch.setattr(resend.Contacts, "update", update)
    monkeypatch.setattr(resend.Contacts, "create", lambda params: calls.append(("create", params)))

    await tasks.sync_newsletter_contact({}, email="fan@example.com", subscribed=True)
    assert calls[-1] == ("create", {"audience_id": "aud_1", "email": "fan@example.com", "unsubscribed": False})

    calls.clear()
    await tasks.sync_newsletter_contact({}, email="gone@example.com", subscribed=False)
    assert [c[0] for c in calls] == ["update"]  # not in the audience → nothing to create


async def test_welcome_email_has_working_unsubscribe_link(monkeypatch):
    sent = []
    monkeypatch.setattr(tasks, "send_email", lambda to, subject, html: sent.append((to, subject, html)))
    await tasks.send_newsletter_welcome_email({}, email="fan@example.com", locale="el")
    to, subject, html = sent[0]
    assert to == "fan@example.com" and subject == "Είστε στη λίστα μας"
    assert "/el/newsletter/unsubscribe?token=" in html
