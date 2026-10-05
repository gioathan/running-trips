from fastapi import APIRouter, Depends, Header, Request

from app.core.dependencies import DbSession, get_current_admin, get_current_user, rate_limit
from app.core.pagination import Page, PageParams, page_params
from app.modules.audit import service as audit_service
from app.modules.payments import service
from app.modules.payments.settings import PaymentSettings, get_payment_settings, save_payment_settings
from app.modules.payments.schemas import CreateIntentRequest, CreateIntentResponse, PaymentAdminRead, PaymentRead
from app.modules.users.models import User

router = APIRouter(prefix="/payments", tags=["payments"])
admin_router = APIRouter(prefix="/admin/payments", tags=["payments"])
settings_router = APIRouter(prefix="/admin/payment-settings", tags=["payments"])


@router.post(
    "/create-intent",
    response_model=CreateIntentResponse,
    # Each call can reach Stripe — keep a script from hammering it.
    dependencies=[Depends(rate_limit("create-intent", max_attempts=20, window_seconds=600))],
)
async def create_intent(body: CreateIntentRequest, db: DbSession, current_user: User = Depends(get_current_user)):
    return await service.create_intent(db, current_user, body.booking_id)


@router.get("/{payment_id}", response_model=PaymentRead)
async def get_payment(payment_id: int, db: DbSession, current_user: User = Depends(get_current_user)):
    return await service.get_payment(db, payment_id, current_user)


@router.post("/webhook", status_code=204)
async def stripe_webhook(request: Request, db: DbSession, stripe_signature: str = Header(...)):
    payload = await request.body()
    await service.handle_webhook(db, payload, stripe_signature)


@admin_router.get("", response_model=Page[PaymentAdminRead], dependencies=[Depends(get_current_admin)])
async def list_payments_admin(db: DbSession, params: PageParams = Depends(page_params), status: str | None = None):
    return await service.list_payments_admin(db, status, params)


@admin_router.post("/{payment_id}/refund", response_model=PaymentAdminRead)
async def refund_payment(payment_id: int, db: DbSession, current_admin: User = Depends(get_current_admin)):
    payment = await service.refund_payment(db, payment_id)
    await audit_service.record(db, current_admin.id, "refund", "payment", payment_id, {"amount_cents": payment.amount_cents})
    return payment


@settings_router.get("", response_model=PaymentSettings, dependencies=[Depends(get_current_admin)])
async def read_payment_settings(db: DbSession):
    return await get_payment_settings(db)


@settings_router.put("", response_model=PaymentSettings)
async def update_payment_settings(body: PaymentSettings, db: DbSession, current_admin: User = Depends(get_current_admin)):
    settings = await save_payment_settings(db, body)
    await audit_service.record(db, current_admin.id, "update", "payment_settings", "payments", settings.model_dump())
    return settings
