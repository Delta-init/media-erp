from typing import Optional
from pydantic import BaseModel


class Attachment(BaseModel):
    url: str
    key: str
    filename: str
    size: int = 0
    content_type: str = "application/octet-stream"
    backend: str = "local"


class CreateTaskRequest(BaseModel):
    title: str
    description: Optional[str] = ""
    priority: str = "medium"          # low | medium | high
    status: str = "pending"           # pending | upcoming | currently_working | updation_needed
    assigned_to: Optional[str] = ""   # user_id (preferred) or legacy free-text name
    assigned_to_name: Optional[str] = ""  # denormalized display name
    due_date: Optional[str] = None    # ISO date string YYYY-MM-DD
    team_id: Optional[str] = None     # optional team association
    attachments: Optional[list[Attachment]] = None
    # Pipeline assignment (optional — only for tasks entering a pipeline)
    pipeline_id: Optional[str] = None
    pipeline_node_id: Optional[str] = None


class UpdateTaskRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    assigned_to: Optional[str] = None
    assigned_to_name: Optional[str] = None
    due_date: Optional[str] = None
    team_id: Optional[str] = None
    attachments: Optional[list[Attachment]] = None
    reedit_reason: Optional[str] = None   # why a review was sent back to reedit
