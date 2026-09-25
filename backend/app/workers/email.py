import resend

from app.core.config import get_settings

settings = get_settings()
resend.api_key = settings.resend_api_key


def send_email(to: str, subject: str, html: str) -> None:
    if not settings.resend_api_key:
        # Local/dev without a Resend key configured — log instead of failing
        # the job so the rest of the flow (booking, signup, etc.) still works.
        print(f"[email:skipped, no RESEND_API_KEY] to={to} subject={subject!r}")
        return
    resend.Emails.send({"from": settings.email_from, "to": [to], "subject": subject, "html": html})
