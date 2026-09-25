import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import UnauthorizedError
from app.core.pagination import Page, PageParams, paginate
from app.core.security import create_email_purpose_token, decode_purpose_token
from app.modules.newsletter.models import NewsletterSubscriber
from app.modules.newsletter.schemas import SubscriberAdminRead

PURPOSE_UNSUBSCRIBE = "newsletter_unsubscribe"


def build_unsubscribe_token(email: str) -> str:
    return create_email_purpose_token(email, PURPOSE_UNSUBSCRIBE, datetime.timedelta(days=365))


async def subscribe(db: AsyncSession, email: str, source: str | None) -> None:
    email = email.lower()
    result = await db.execute(select(NewsletterSubscriber).where(NewsletterSubscriber.email == email))
    subscriber = result.scalar_one_or_none()
    now = datetime.datetime.now(datetime.UTC)
    if subscriber is None:
        db.add(NewsletterSubscriber(email=email, subscribed_at=now, source=source))
    elif subscriber.unsubscribed_at is not None:
        subscriber.unsubscribed_at = None
        subscriber.subscribed_at = now
    # else: already subscribed — no-op, dedupe on email per BACKEND_PLAN.md.
    await db.commit()


async def unsubscribe(db: AsyncSession, token: str) -> None:
    try:
        payload = decode_purpose_token(token, PURPOSE_UNSUBSCRIBE)
    except Exception as exc:
        raise UnauthorizedError("Invalid or expired unsubscribe link.") from exc

    result = await db.execute(select(NewsletterSubscriber).where(NewsletterSubscriber.email == payload["sub"]))
    subscriber = result.scalar_one_or_none()
    if subscriber and subscriber.unsubscribed_at is None:
        subscriber.unsubscribed_at = datetime.datetime.now(datetime.UTC)
        await db.commit()


async def list_subscribers_admin(db: AsyncSession, params: PageParams) -> Page[SubscriberAdminRead]:
    stmt = select(NewsletterSubscriber).order_by(NewsletterSubscriber.subscribed_at.desc())
    rows, total = await paginate(db, stmt, params)
    items = [SubscriberAdminRead.model_validate(r, from_attributes=True) for r in rows]
    return Page(items=items, total=total, page=params.page, page_size=params.page_size)
