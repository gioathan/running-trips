from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.exceptions import register_exception_handlers
from app.core.hardening import register_hardening
from app.core.revalidation import register_revalidation_hook
from app.modules.admin_auth.router import router as admin_auth_router
from app.modules.auth.router import router as auth_router
from app.modules.bookings.router import router as bookings_router
from app.modules.contact.router import router as contact_router
from app.modules.content.router import router as content_router
from app.modules.newsletter.router import router as newsletter_router
from app.modules.payments.router import admin_router as admin_payments_router
from app.modules.payments.router import router as payments_router
from app.modules.payments.router import settings_router as payment_settings_router
from app.modules.race_categories.router import router as race_categories_router
from app.modules.trip_comments.router import router as trip_comments_router
from app.modules.trips.router import router as trips_router
from app.modules.uploads.router import router as uploads_router
from app.modules.users.router import router as users_router

settings = get_settings()

# Interactive docs and the OpenAPI schema are a development aid — in
# production they'd hand any visitor a map of every endpoint, admin included.
_docs = {} if settings.environment == "local" else {"docs_url": None, "redoc_url": None, "openapi_url": None}
app = FastAPI(title="Running Trips API", version="0.1.0", **_docs)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)
register_hardening(app)
register_revalidation_hook(app)

for router in (
    auth_router,
    admin_auth_router,
    users_router,
    race_categories_router,
    trips_router,
    trip_comments_router,
    bookings_router,
    payments_router,
    admin_payments_router,
    payment_settings_router,
    content_router,
    newsletter_router,
    contact_router,
    uploads_router,
):
    app.include_router(router)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
