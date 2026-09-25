from fastapi import APIRouter, Depends

from app.core.dependencies import DbSession, get_current_admin, rate_limit
from app.core.pagination import Page, PageParams, page_params
from app.modules.newsletter import service
from app.modules.newsletter.schemas import SubscribeRequest, SubscriberAdminRead, UnsubscribeRequest

router = APIRouter(tags=["newsletter"])


@router.post(
    "/newsletter/subscribe",
    status_code=204,
    dependencies=[Depends(rate_limit("newsletter-subscribe", max_attempts=10, window_seconds=60))],
)
async def subscribe(body: SubscribeRequest, db: DbSession):
    await service.subscribe(db, body.email, body.source)


@router.post("/newsletter/unsubscribe", status_code=204)
async def unsubscribe(body: UnsubscribeRequest, db: DbSession):
    await service.unsubscribe(db, body.token)


@router.get(
    "/admin/newsletter/subscribers", response_model=Page[SubscriberAdminRead], dependencies=[Depends(get_current_admin)]
)
async def list_subscribers(db: DbSession, params: PageParams = Depends(page_params)):
    return await service.list_subscribers_admin(db, params)
