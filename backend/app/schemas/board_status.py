from typing import Optional
from pydantic import BaseModel


class CreateStatusRequest(BaseModel):
    label: str
    color: str = "#6366f1"


class UpdateStatusRequest(BaseModel):
    label: Optional[str] = None
    color: Optional[str] = None
    position: Optional[int] = None


class ReorderStatusesRequest(BaseModel):
    ordered_ids: list[str]
