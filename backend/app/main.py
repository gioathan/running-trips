from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.exceptions import register_exception_handlers
from app.modules.admin_auth.router import router as admin_auth_router
from app.modules.auth.router import router as auth_router
from app.modules.bookings.router import router as bookings_router
from app.modules.contact.router import router as contact_router
from app.modules.content.router import router as content_router
from app.modules.newsletter.router import router as newsletter_router
from app.modules.payments.router import router as payments_router
from app.modules.race_categories.router import router as race_categories_router
from app.modules.trips.router import router as trips_router
from app.modules.uploads.router import router as uploads_router
from app.modules.users.router import router as users_router

settings = get_settings()

app = FastAPI(title="Running Trips API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)

for router in (
    auth_router,
    admin_auth_router,
    users_router,
    race_categories_router,
    trips_router,
    bookings_router,
    payments_router,
    content_router,
    newsletter_router,
    contact_router,
    uploads_router,
):
    app.include_router(router)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
