import time

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
# revalidation: every write in the same few-second bucket shares a job id,
# and arq ignores an enqueue whose id it has already seen. The id must
# change between buckets — arq also remembers *finished* jobs for an hour,
# so one fixed id would let only the first save of the hour through.
REVALIDATE_BUCKET_SECONDS = 3


def revalidation_job_id(now: float | None = None) -> str:
    return f"revalidate-frontend:{int((now if now is not None else time.time()) // REVALIDATE_BUCKET_SECONDS)}"


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
            # Deferred to the end of the bucket so the job runs after the
            # last write it stands for.
            await enqueue_email(
                "revalidate_frontend", _job_id=revalidation_job_id(), _defer_by=REVALIDATE_BUCKET_SECONDS
            )
        return response
