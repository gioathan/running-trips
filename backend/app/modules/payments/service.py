import datetime

import stripe
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError, UnauthorizedError
from app.core.redis import get_redis
from app.modules.bookings.models import Booking, BookingStatus
from app.modules.payments import stripe_client
from app.modules.payments.models import Payment, PaymentStatus
from app.modules.payments.schemas import CreateIntentResponse, PaymentRead
from app.modules.users.models import User
from app.workers.enqueue import enqueue_email

WEBHOOK_DEDUPE_TTL_SECONDS = 60 * 60 * 24 * 7


async def create_intent(db: AsyncSession, user: User, booking_id: int) -> CreateIntentResponse:
    booking = await db.get(Booking, booking_id)
    if booking is None:
        raise NotFoundError("Booking not found.")
    if booking.user_id != user.id:
        raise ForbiddenError("You don't have access to this booking.")
    if booking.status not in (BookingStatus.pending, BookingStatus.awaiting_payment):
        raise ConflictError(f"Booking is already {booking.status}.")

    # Reuse an existing not-yet-paid PaymentIntent for this booking instead
    # of creating a duplicate one on retry/refresh.
    result = await db.execute(
        select(Payment).where(Payment.booking_id == booking_id, Payment.status == PaymentStatus.requires_payment)
    )
    existing = result.scalar_one_or_none()
    if existing:
        intent = stripe.PaymentIntent.retrieve(existing.provider_ref)
        return CreateIntentResponse(
            payment_id=existing.id, client_secret=intent.client_secret, amount_cents=existing.amount_cents
        )

    intent = stripe_client.create_payment_intent(booking.total_amount_cents, metadata={"booking_id": str(booking.id)})
    payment = Payment(
        booking_id=booking.id,
        provider_ref=intent.id,
        amount_cents=booking.total_amount_cents,
        status=PaymentStatus.requires_payment,
        created_at=datetime.datetime.now(datetime.UTC),
    )
    booking.status = BookingStatus.awaiting_payment
    db.add(payment)
    await db.commit()
    await db.refresh(payment)
    return CreateIntentResponse(payment_id=payment.id, client_secret=intent.client_secret, amount_cents=payment.amount_cents)


async def get_payment(db: AsyncSession, payment_id: int, user: User) -> PaymentRead:
    payment = await db.get(Payment, payment_id)
    if payment is None:
        raise NotFoundError("Payment not found.")
    booking = await db.get(Booking, payment.booking_id)
    if booking.user_id != user.id and user.role != "admin":
        raise ForbiddenError("You don't have access to this payment.")
    return PaymentRead(
        id=payment.id, booking_id=payment.booking_id, provider=payment.provider, status=payment.status, amount_cents=payment.amount_cents
    )


async def handle_webhook(db: AsyncSession, payload: bytes, sig_header: str) -> None:
    try:
        event = stripe_client.construct_webhook_event(payload, sig_header)
    except (ValueError, stripe.StripeError) as exc:
        # stripe.StripeError (rather than the more specific
        # SignatureVerificationError) is the stable top-level symbol across
        # stripe-python versions — covers both a malformed payload and a bad signature.
        raise UnauthorizedError("Invalid Stripe webhook signature.") from exc

    redis = get_redis()
    dedupe_key = f"stripe-event:{event['id']}"
    was_set = await redis.set(dedupe_key, "1", nx=True, ex=WEBHOOK_DEDUPE_TTL_SECONDS)
    if not was_set:
        return  # Already processed this event — webhook retries are expected.

    if event["type"] not in ("payment_intent.succeeded", "payment_intent.payment_failed"):
        return

    intent = event["data"]["object"]
    result = await db.execute(select(Payment).where(Payment.provider_ref == intent["id"]))
    payment = result.scalar_one_or_none()
    if payment is None:
        return

    payment.raw_payload = intent

    if event["type"] == "payment_intent.succeeded":
        payment.status = PaymentStatus.succeeded
        booking = await db.get(Booking, payment.booking_id)
        booking.status = BookingStatus.confirmed
        await db.commit()
        await enqueue_email("send_booking_confirmation_email", booking_id=booking.id)
    else:
        payment.status = PaymentStatus.failed
        await db.commit()
