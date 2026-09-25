import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError
from app.core.pagination import Page, PageParams, paginate
from app.modules.contact.models import ContactMessage, InquiryType, MessageStatus
from app.modules.contact.schemas import ContactMessageAdminRead
from app.modules.users.models import User
from app.workers.enqueue import enqueue_email


async def create_message(db: AsyncSession, user: User, inquiry_type: str, trip_id: int | None, message: str) -> ContactMessage:
    contact_message = ContactMessage(
        user_id=user.id,
        inquiry_type=InquiryType(inquiry_type),
        trip_id=trip_id,
        message=message,
        created_at=datetime.datetime.now(datetime.UTC),
    )
    db.add(contact_message)
    await db.commit()
    await db.refresh(contact_message)
    await enqueue_email("send_contact_acknowledgment_email", user_id=user.id, message_id=contact_message.id)
    return contact_message


async def _to_admin_read(db: AsyncSession, message: ContactMessage) -> ContactMessageAdminRead:
    user = await db.get(User, message.user_id)
    return ContactMessageAdminRead(
        id=message.id,
        user_id=message.user_id,
        user_email=user.email,
        inquiry_type=message.inquiry_type,
        trip_id=message.trip_id,
        message=message.message,
        status=message.status,
        created_at=message.created_at,
    )


async def list_messages_admin(db: AsyncSession, status_filter: str | None, params: PageParams) -> Page[ContactMessageAdminRead]:
    stmt = select(ContactMessage).order_by(ContactMessage.created_at.desc())
    if status_filter:
        stmt = stmt.where(ContactMessage.status == MessageStatus(status_filter))
    rows, total = await paginate(db, stmt, params)
    items = [await _to_admin_read(db, m) for m in rows]
    return Page(items=items, total=total, page=params.page, page_size=params.page_size)


async def update_message_status(db: AsyncSession, message_id: int, new_status: str) -> ContactMessageAdminRead:
    message = await db.get(ContactMessage, message_id)
    if message is None:
        raise NotFoundError("Contact message not found.")
    try:
        message.status = MessageStatus(new_status)
    except ValueError as exc:
        raise ConflictError(f"Invalid message status: {new_status}") from exc
    await db.commit()
    await db.refresh(message)
    return await _to_admin_read(db, message)
