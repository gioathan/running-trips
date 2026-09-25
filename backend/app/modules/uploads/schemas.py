from pydantic import BaseModel


class PresignRequest(BaseModel):
    filename: str
    content_type: str


class PresignResponse(BaseModel):
    upload_url: str
    public_url: str
    object_key: str
