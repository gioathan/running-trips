import stripe

from app.core.config import get_settings

settings = get_settings()
stripe.api_key = settings.stripe_secret_key


def create_payment_intent(amount_cents: int, metadata: dict) -> stripe.PaymentIntent:
    return stripe.PaymentIntent.create(
        amount=amount_cents,
        currency="eur",
        metadata=metadata,
        automatic_payment_methods={"enabled": True},
    )


def construct_webhook_event(payload: bytes, sig_header: str) -> stripe.Event:
    return stripe.Webhook.construct_event(payload, sig_header, settings.stripe_webhook_secret)


def cancel_payment_intent(intent_id: str) -> bool:
    """Cancels an unpaid PaymentIntent so it can no longer be paid. Returns
    False if Stripe refuses — e.g. it already succeeded or is processing —
    in which case the caller must leave the booking alone."""
    if not settings.stripe_secret_key:
        return True  # Stripe not configured (local dev) — nothing to cancel upstream.
    try:
        stripe.PaymentIntent.cancel(intent_id)
    except stripe.StripeError:
        return False
    return True


def refund_payment_intent(intent_id: str) -> None:
    """Full refund of a captured PaymentIntent. Raises stripe.StripeError on failure."""
    stripe.Refund.create(payment_intent=intent_id)
