from fastapi import APIRouter, Depends

from app.core.dependencies import get_current_admin
from app.modules.uploads import service
from app.modules.uploads.schemas import PresignRequest, PresignResponse

router = APIRouter(tags=["uploads"])


@router.post("/admin/uploads/presign", response_model=PresignResponse, dependencies=[Depends(get_current_admin)])
async def presign_upload(body: PresignRequest):
    return service.create_presigned_upload(body.filename, body.content_type)
