from arq import cron
from arq.connections import RedisSettings

from app.core.config import get_settings
from app.workers.tasks import (
    release_expired_bookings,
    send_booking_confirmation_email,
    send_contact_acknowledgment_email,
    send_password_reset_email,
    send_verification_email,
)

settings = get_settings()


class WorkerSettings:
    redis_settings = RedisSettings.from_dsn(settings.redis_url)
    functions = [
        send_verification_email,
        send_password_reset_email,
        send_booking_confirmation_email,
        send_contact_acknowledgment_email,
    ]
    cron_jobs = [
        cron(release_expired_bookings, minute=set(range(0, 60, 5))),  # every 5 minutes
    ]
