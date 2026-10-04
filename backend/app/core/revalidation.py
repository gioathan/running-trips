from fastapi import FastAPI, Request

from app.core.config import get_settings
from app.workers.enqueue import enqueue_email

# Admin resources whose writes change what public pages show: trip pages and
# listings, the home page's featured trips and the layout's trip ticker, CMS
# pages, the footer (site settings), and trip pages' comment lists.
PUBLIC_CONTENT_PREFIXES = (
    "/admin/trips",
    "/admin/trip-comments",
    "/admin/race-categories",
    "/admin/content",
    "/admin/site-settings",
)
WRITE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

# Coalesces bursts (saving a trip, then adding three images) into one
# revalidation: arq ignores an enqueue whose job id is already queued, and the
# short defer gives the burst time to land on that one job.
REVALIDATE_JOB_ID = "revalidate-frontend"
REVALIDATE_DEFER_SECONDS = 3


def register_revalidation_hook(app: FastAPI) -> None:
    """Requests on-demand ISR revalidation after any successful admin write to
    public content — one hook here rather than a call in every admin route,
    so newly added admin endpoints under these prefixes are covered too."""

    @app.middleware("http")
    async def _revalidate_after_content_write(request: Request, call_next):
        response = await call_next(request)
        if (
            get_settings().revalidate_secret
            and request.method in WRITE_METHODS
            and request.url.path.startswith(PUBLIC_CONTENT_PREFIXES)
            and response.status_code < 400
        ):
            await enqueue_email(
                "revalidate_frontend", _job_id=REVALIDATE_JOB_ID, _defer_by=REVALIDATE_DEFER_SECONDS
            )
        return response
