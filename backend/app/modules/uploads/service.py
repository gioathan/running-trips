import uuid
from datetime import UTC, datetime

import boto3
from botocore.config import Config

from app.core.config import get_settings
from app.core.exceptions import ServiceNotConfiguredError, ValidationAppError
from app.modules.uploads.schemas import PresignResponse

settings = get_settings()


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
