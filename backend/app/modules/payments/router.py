from fastapi import APIRouter, Depends, Header, Request

from app.core.dependencies import DbSession, get_current_user
from app.modules.payments import service
from app.modules.payments.schemas import CreateIntentRequest, CreateIntentResponse, PaymentRead
from app.modules.users.models import User

router = APIRouter(prefix="/payments", tags=["payments"])


@router.post("/create-intent", response_model=CreateIntentResponse)
async def create_intent(body: CreateIntentRequest, db: DbSession, current_user: User = Depends(get_current_user)):
    return await service.create_intent(db, current_user, body.booking_id)


@router.get("/{payment_id}", response_model=PaymentRead)
async def get_payment(payment_id: int, db: DbSession, current_user: User = Depends(get_current_user)):
    return await service.get_payment(db, payment_id, current_user)


@router.post("/webhook", status_code=204)
async def stripe_webhook(request: Request, db: DbSession, stripe_signature: str = Header(...)):
    payload = await request.body()
    await service.handle_webhook(db, payload, stripe_signature)
