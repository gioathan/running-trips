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
