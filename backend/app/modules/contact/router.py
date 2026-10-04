from fastapi import APIRouter, Depends

from app.core.dependencies import DbSession, get_current_admin, get_current_user, rate_limit
from app.core.pagination import Page, PageParams, page_params
from app.modules.audit import service as audit_service
from app.modules.contact import service
from app.modules.contact.schemas import (
    ContactMessageAdminRead,
    ContactMessageCreate,
    ContactMessageStatusUpdate,
)
from app.modules.users.models import User

router = APIRouter(tags=["contact"])


@router.post(
    "/contact",
    status_code=201,
    dependencies=[Depends(rate_limit("contact", max_attempts=5, window_seconds=600))],
)
async def create_contact_message(body: ContactMessageCreate, db: DbSession, current_user: User = Depends(get_current_user)):
    message = await service.create_message(db, current_user, body.inquiry_type, body.trip_id, body.message)
    return {"id": message.id}


@router.get(
    "/admin/contact-messages", response_model=Page[ContactMessageAdminRead], dependencies=[Depends(get_current_admin)]
)
async def list_contact_messages(db: DbSession, params: PageParams = Depends(page_params), status: str | None = None):
    return await service.list_messages_admin(db, status, params)


@router.patch("/admin/contact-messages/{message_id}", response_model=ContactMessageAdminRead)
async def update_contact_message(
    message_id: int, body: ContactMessageStatusUpdate, db: DbSession, current_admin: User = Depends(get_current_admin)
):
    message = await service.update_message_status(db, message_id, body.status)
    await audit_service.record(db, current_admin.id, "update", "contact_message", message_id, {"status": body.status})
    return message
