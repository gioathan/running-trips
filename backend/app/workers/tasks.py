from app.core.config import get_settings
from app.db.session import AsyncSessionLocal
from app.modules.auth.service import build_password_reset_token, build_verify_email_token
from app.modules.bookings.models import Booking
from app.modules.bookings.service import release_expired_pending_bookings
from app.modules.contact.models import ContactMessage
from app.modules.trips.models import Trip
from app.modules.users.models import User
from app.workers.email import send_email

settings = get_settings()


async def send_verification_email(ctx, user_id: int) -> None:
    async with AsyncSessionLocal() as db:
        user = await db.get(User, user_id)
        if user is None or user.email_verified:
            return
        token = build_verify_email_token(user)
        link = f"{settings.frontend_origin}/{user.locale}/verify-email?token={token}"
        send_email(user.email, "Verify your email", f"<p>Confirm your email: <a href='{link}'>{link}</a></p>")


async def send_password_reset_email(ctx, user_id: int) -> None:
    async with AsyncSessionLocal() as db:
        user = await db.get(User, user_id)
        if user is None:
            return
        token = build_password_reset_token(user)
        link = f"{settings.frontend_origin}/{user.locale}/reset-password?token={token}"
        send_email(user.email, "Reset your password", f"<p>Reset your password: <a href='{link}'>{link}</a></p>")


async def send_booking_confirmation_email(ctx, booking_id: int) -> None:
    async with AsyncSessionLocal() as db:
        booking = await db.get(Booking, booking_id)
        if booking is None:
            return
        user = await db.get(User, booking.user_id)
        trip = await db.get(Trip, booking.trip_id)
        translation = trip.translations[0] if trip.translations else None
        title = translation.title if translation else trip.slug
        send_email(
            user.email,
            "Your booking is confirmed",
            f"<p>Your booking for <strong>{title}</strong> is confirmed. See you on the start line!</p>",
        )


async def send_contact_acknowledgment_email(ctx, user_id: int, message_id: int) -> None:
    async with AsyncSessionLocal() as db:
        user = await db.get(User, user_id)
        message = await db.get(ContactMessage, message_id)
        if user is None or message is None:
            return
        send_email(
            user.email,
            "We received your message",
            "<p>Thanks for reaching out — our team responds within 24 hours.</p>",
        )


async def release_expired_bookings(ctx) -> None:
    """Scheduled job (BACKEND_PLAN.md §8): frees seats held by abandoned
    pending bookings so they don't count against capacity forever."""
    async with AsyncSessionLocal() as db:
        released = await release_expired_pending_bookings(db)
        if released:
            print(f"[worker] released {released} expired pending booking(s)")
