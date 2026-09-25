import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.audit.models import AuditLog


async def record(db: AsyncSession, admin_user_id: int, action: str, entity_type: str, entity_id: str, diff: dict) -> None:
    """Fire-and-forget audit trail entry for an admin mutation. Commits on
    its own so a later failure in the caller's transaction doesn't erase
    the record of what was attempted — call this *after* the caller's own
    commit succeeds.

    Wired into a representative set of admin write paths (trips, bookings,
    content) as the pattern to extend to the rest as they're built out."""
    db.add(
        AuditLog(
            admin_user_id=admin_user_id,
            action=action,
            entity_type=entity_type,
            entity_id=str(entity_id),
            diff=diff,
            created_at=datetime.datetime.now(datetime.UTC),
        )
    )
    await db.commit()
