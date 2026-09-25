import uuid
from datetime import datetime

import boto3
from botocore.config import Config

from app.core.config import get_settings
from app.core.exceptions import AppError
from app.modules.uploads.schemas import PresignResponse

settings = get_settings()

PRESIGN_TTL_SECONDS = 300


def _client():
    if not settings.r2_endpoint_url:
        raise AppError("Object storage is not configured.", details={"code": "STORAGE_NOT_CONFIGURED"})
    return boto3.client(
        "s3",
        endpoint_url=settings.r2_endpoint_url,
        aws_access_key_id=settings.r2_access_key_id,
        aws_secret_access_key=settings.r2_secret_access_key,
        config=Config(signature_version="s3v4"),
        region_name="auto",
    )


def create_presigned_upload(filename: str, content_type: str) -> PresignResponse:
    safe_ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "bin"
    object_key = f"{datetime.utcnow():%Y/%m}/{uuid.uuid4().hex}.{safe_ext}"

    client = _client()
    upload_url = client.generate_presigned_url(
        "put_object",
        Params={"Bucket": settings.r2_bucket_name, "Key": object_key, "ContentType": content_type},
        ExpiresIn=PRESIGN_TTL_SECONDS,
    )
    public_url = f"{settings.r2_public_base_url.rstrip('/')}/{object_key}"
    return PresignResponse(upload_url=upload_url, public_url=public_url, object_key=object_key)
