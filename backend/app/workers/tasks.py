import html
import logging

import httpx
import resend

from app.core.config import get_settings
from app.core.i18n import resolve_translation
from app.db.session import AsyncSessionLocal
from app.modules.auth.service import build_password_reset_token, build_verify_email_token
from app.modules.bookings.models import Booking, BookingStatus
from app.modules.bookings.service import release_expired_pending_bookings
from app.modules.contact.models import ContactMessage
from app.modules.newsletter.service import build_unsubscribe_token
from app.modules.payments.settings import external_payment_due_at, external_payment_url, get_payment_settings
from app.modules.trips.models import Trip
from app.modules.users.models import User
from app.workers.email import send_email

settings = get_settings()
logger = logging.getLogger(__name__)

# Sent in the recipient's `users.locale`, not the locale of whatever page
# triggered the email (BACKEND_PLAN.md §10).
EMAIL_COPY = {
    "verify": {
        "en": ("Verify your email", "Confirm your email address: <a href='{link}'>{link}</a>"),
        "el": ("Επιβεβαιώστε το email σας", "Επιβεβαιώστε τη διεύθυνση email σας: <a href='{link}'>{link}</a>"),
    },
    "reset": {
        "en": (
            "Reset your password",
            "Reset your password: <a href='{link}'>{link}</a><br>This link expires in 1 hour.",
        ),
        "el": (
            "Επαναφορά κωδικού πρόσβασης",
            "Επαναφέρετε τον κωδικό σας: <a href='{link}'>{link}</a><br>Ο σύνδεσμος λήγει σε 1 ώρα.",
        ),
    },
    "booking_confirmed": {
        "en": (
            "Your booking is confirmed",
            "Your booking for <strong>{title}</strong> is confirmed. See you on the start line!",
        ),
        "el": (
            "Η κράτησή σας επιβεβαιώθηκε",
            "Η κράτησή σας για το <strong>{title}</strong> επιβεβαιώθηκε. Τα λέμε στη γραμμή εκκίνησης!",
        ),
    },
    "newsletter_welcome": {
        "en": (
            "You're on the list",
            "Thanks for subscribing to the ΑΛΛΟΥ newsletter — new trips and race news, a few times a season."
            "<br><br><small>Not for you? <a href='{link}'>Unsubscribe</a>.</small>",
        ),
        "el": (
            "Είστε στη λίστα μας",
            "Ευχαριστούμε για την εγγραφή στο newsletter της ΑΛΛΟΥ — νέα ταξίδια και νέα αγώνων, λίγες φορές τη σεζόν."
            "<br><br><small>Δεν σας ενδιαφέρει; <a href='{link}'>Διαγραφή</a>.</small>",
        ),
    },
    "external_payment": {
        "en": (
            "Complete your booking for {title}",
            "We've reserved your place on <strong>{title}</strong> (booking reference <strong>#{booking_id}</strong>)."
            "<br><br>Payment is handled by our partner office: <a href='{link}'>{link}</a>"
            "<br><br>Your seats are held until <strong>{due}</strong>. We'll email you as soon as the payment is "
            "confirmed.",
        ),
        "el": (
            "Ολοκληρώστε την κράτησή σας για {title}",
            "Κρατήσαμε τη θέση σας για το <strong>{title}</strong> (κωδικός κράτησης <strong>#{booking_id}</strong>)."
            "<br><br>Η πληρωμή γίνεται μέσω του συνεργαζόμενου γραφείου μας: <a href='{link}'>{link}</a>"
            "<br><br>Οι θέσεις σας κρατούνται έως <strong>{due}</strong>. Θα σας ενημερώσουμε με email μόλις "
            "επιβεβαιωθεί η πληρωμή.",
        ),
    },
    "contact_ack": {
        "en": ("We received your message", "Thanks for reaching out — our team responds within 24 hours."),
        "el": ("Λάβαμε το μήνυμά σας", "Ευχαριστούμε που επικοινωνήσατε — η ομάδα μας απαντά εντός 24 ωρών."),
    },
}


def _send_localized(user: User, kind: str, **params: str) -> None:
    _send_localized_to(user.email, user.locale, kind, **params)


def _booking_email(booking: Booking, user: User) -> str:
    # The booking's own contact email (may differ from the account's);
    # bookings made before that field existed fall back to the account.
    return booking.contact_email or user.email


def _send_localized_to(email: str, locale: str, kind: str, **params: str) -> None:
    copy = EMAIL_COPY[kind]
    subject, body = copy.get(locale, copy["en"])
    send_email(email, subject.format(**params), f"<p>{body.format(**params)}</p>")


async def send_verification_email(ctx, user_id: int) -> None:
    async with AsyncSessionLocal() as db:
        user = await db.get(User, user_id)
        if user is None or user.email_verified:
            return
        token = build_verify_email_token(user)
        link = f"{settings.frontend_origin}/{user.locale}/verify-email?token={token}"
        _send_localized(user, "verify", link=link)


async def send_password_reset_email(ctx, user_id: int) -> None:
    async with AsyncSessionLocal() as db:
        user = await db.get(User, user_id)
        if user is None:
            return
        token = build_password_reset_token(user)
        link = f"{settings.frontend_origin}/{user.locale}/reset-password?token={token}"
        _send_localized(user, "reset", link=link)


async def send_booking_confirmation_email(ctx, booking_id: int) -> None:
    async with AsyncSessionLocal() as db:
        booking = await db.get(Booking, booking_id)
        if booking is None:
            return
        user = await db.get(User, booking.user_id)
        trip = await db.get(Trip, booking.trip_id)
        translation = resolve_translation(trip.translations, user.locale)
        title = translation.title if translation else trip.slug
        _send_localized_to(_booking_email(booking, user), user.locale, "booking_confirmed", title=html.escape(title))


async def send_external_payment_instructions_email(ctx, booking_id: int) -> None:
    async with AsyncSessionLocal() as db:
        booking = await db.get(Booking, booking_id)
        if booking is None or booking.status != BookingStatus.awaiting_payment:
            return
        user = await db.get(User, booking.user_id)
        trip = await db.get(Trip, booking.trip_id)
        payment_settings = await get_payment_settings(db)
        link = external_payment_url(payment_settings, trip.external_payment_url, booking.id)
        if link is None:
            return
        translation = resolve_translation(trip.translations, user.locale)
        _send_localized_to(
            _booking_email(booking, user),
            user.locale,
            "external_payment",
            title=html.escape(translation.title if translation else trip.slug),
            booking_id=str(booking.id),
            link=html.escape(link, quote=True),
            due=external_payment_due_at(payment_settings, booking.created_at).strftime("%d/%m/%Y"),
        )


async def send_contact_acknowledgment_email(ctx, user_id: int, message_id: int) -> None:
    async with AsyncSessionLocal() as db:
        user = await db.get(User, user_id)
        message = await db.get(ContactMessage, message_id)
        if user is None or message is None:
            return
        _send_localized(user, "contact_ack")


async def release_expired_bookings(ctx) -> None:
    """Scheduled job (BACKEND_PLAN.md §8): frees seats held by abandoned
    pending bookings so they don't count against capacity forever."""
    async with AsyncSessionLocal() as db:
        released = await release_expired_pending_bookings(db)
        if released:
            print(f"[worker] released {released} expired pending booking(s)")


async def revalidate_frontend(ctx) -> None:
    """Tells the Next.js frontend to drop its ISR cache for every page
    (FRONTEND_PLAN.md §9) after an admin content write — see
    app/core/revalidation.py for what triggers it."""
    if not settings.revalidate_secret:
        return
    url = f"{settings.frontend_origin.rstrip('/')}/api/revalidate"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            res = await client.post(url, json={"secret": settings.revalidate_secret, "path": "/"})
    except httpx.HTTPError as exc:
        # A backup path: the admin UI's own proxy already revalidates after
        # each save. Expected to fail where the worker can't reach the
        # frontend — e.g. local dev with the backend in Docker.
        logger.warning("Frontend revalidation could not reach %s: %s", url, type(exc).__name__)
        return
    if res.status_code >= 400:
        logger.warning("Frontend revalidation failed: %s %s", res.status_code, res.text[:200])


async def send_newsletter_welcome_email(ctx, email: str, locale: str) -> None:
    locale = locale if locale in ("en", "el") else "en"
    link = f"{settings.frontend_origin}/{locale}/newsletter/unsubscribe?token={build_unsubscribe_token(email)}"
    _send_localized_to(email, locale, "newsletter_welcome", link=link)


async def sync_newsletter_contact(ctx, email: str, subscribed: bool) -> None:
    """Mirrors a subscribe/unsubscribe into the Resend Audience that
    broadcasts go out from (BACKEND_PLAN.md §2). Update-then-create, since
    the contact may or may not exist there yet (resubscribes, imports).

    One-way: someone who unsubscribes via a Resend broadcast's own link is
    unsubscribed in Resend — which is what controls sending — but stays
    "subscribed" in this app's admin list."""
    if not (settings.resend_api_key and settings.resend_audience_id):
        return
    audience = settings.resend_audience_id
    try:
        # Resend accepts the email in place of the contact id here.
        resend.Contacts.update({"audience_id": audience, "id": email, "unsubscribed": not subscribed})
    except Exception:
        if not subscribed:
            return  # not in the audience — nothing to unsubscribe
        resend.Contacts.create({"audience_id": audience, "email": email, "unsubscribed": False})
