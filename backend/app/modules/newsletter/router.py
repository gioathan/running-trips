from fastapi import APIRouter, Depends

from app.core.dependencies import DbSession, get_current_admin, rate_limit
from app.core.pagination import Page, PageParams, page_params
from app.modules.newsletter import service
from app.modules.newsletter.schemas import SubscribeRequest, SubscriberAdminRead, UnsubscribeRequest
from app.workers.enqueue import enqueue_email

router = APIRouter(tags=["newsletter"])


@router.post(
    "/newsletter/subscribe",
    status_code=204,
    dependencies=[Depends(rate_limit("newsletter-subscribe", max_attempts=10, window_seconds=60))],
)
async def subscribe(body: SubscribeRequest, db: DbSession):
    if await service.subscribe(db, body.email, body.source):
        email = body.email.lower()
        await enqueue_email("sync_newsletter_contact", email=email, subscribed=True)
        await enqueue_email("send_newsletter_welcome_email", email=email, locale=body.locale)


@router.post("/newsletter/unsubscribe", status_code=204)
async def unsubscribe(body: UnsubscribeRequest, db: DbSession):
    email = await service.unsubscribe(db, body.token)
    if email:
        await enqueue_email("sync_newsletter_contact", email=email, subscribed=False)


@router.get(
    "/admin/newsletter/subscribers", response_model=Page[SubscriberAdminRead], dependencies=[Depends(get_current_admin)]
)
async def list_subscribers(db: DbSession, params: PageParams = Depends(page_params)):
    return await service.list_subscribers_admin(db, params)
