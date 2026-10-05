import logging
import uuid
from datetime import UTC, datetime

import boto3
from botocore.config import Config

from app.core.config import get_settings
from app.core.exceptions import ServiceNotConfiguredError, ValidationAppError
from app.modules.uploads.schemas import PresignResponse

settings = get_settings()
logger = logging.getLogger(__name__)


class StorageNotConfiguredError(ServiceNotConfiguredError):
    code = "STORAGE_NOT_CONFIGURED"

PRESIGN_TTL_SECONDS = 300


def _client():
    if not settings.r2_endpoint_url:
        raise StorageNotConfiguredError("Object storage is not configured.")
    return boto3.client(
        "s3",
        endpoint_url=settings.r2_endpoint_url,
        aws_access_key_id=settings.r2_access_key_id,
        aws_secret_access_key=settings.r2_secret_access_key,
        config=Config(signature_version="s3v4"),
        region_name="auto",
    )


# Only images are uploaded through the admin (trip galleries, covers, CMS
# imagery). The extension comes from this map rather than the client's
# filename, so a key can never end in e.g. `.html` and be served as a page
# from the public media domain.
ALLOWED_CONTENT_TYPES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/avif": "avif",
    "image/gif": "gif",
}


def create_presigned_upload(filename: str, content_type: str) -> PresignResponse:
    ext = ALLOWED_CONTENT_TYPES.get(content_type.lower())
    if ext is None:
        raise ValidationAppError(
            f"Unsupported file type: {content_type}.", details={"allowed": sorted(ALLOWED_CONTENT_TYPES)}
        )
    object_key = f"{datetime.now(UTC):%Y/%m}/{uuid.uuid4().hex}.{ext}"

    client = _client()
    upload_url = client.generate_presigned_url(
        "put_object",
        Params={"Bucket": settings.r2_bucket_name, "Key": object_key, "ContentType": content_type},
        ExpiresIn=PRESIGN_TTL_SECONDS,
    )
    public_url = f"{settings.r2_public_base_url.rstrip('/')}/{object_key}"
    return PresignResponse(upload_url=upload_url, public_url=public_url, object_key=object_key)


def object_key_for(url: str | None) -> str | None:
    """The bucket key behind a public media URL, or None if the URL isn't
    one of ours (an image pasted from another site, a seed placeholder)."""
    base = settings.r2_public_base_url.rstrip("/") + "/"
    if not url or not url.startswith(base):
        return None
    key = url[len(base):].split("?", 1)[0]
    return key or None


def delete_objects(urls: list[str]) -> int:
    """Remove the given public media URLs' files from the bucket. Best
    effort: storage being unconfigured or unreachable is logged, never
    raised — the database change the caller just made must stand either way.
    Returns how many files were deleted."""
    keys = sorted({key for key in map(object_key_for, urls) if key})
    if not keys or not settings.r2_endpoint_url:
        return 0
    try:
        client = _client()
        deleted = 0
        for start in range(0, len(keys), 1000):  # S3 batch limit
            batch = keys[start : start + 1000]
            response = client.delete_objects(
                Bucket=settings.r2_bucket_name, Delete={"Objects": [{"Key": k} for k in batch], "Quiet": True}
            )
            errors = response.get("Errors", [])
            for error in errors:
                logger.warning("Could not delete %s from storage: %s", error.get("Key"), error.get("Message"))
            deleted += len(batch) - len(errors)
        return deleted
    except Exception:
        logger.exception("Deleting %d file(s) from storage failed", len(keys))
        return 0
