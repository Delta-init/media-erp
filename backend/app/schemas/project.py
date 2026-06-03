from typing import Optional
from pydantic import BaseModel


class CreateTaskRequest(BaseModel):
    title: str
    description: Optional[str] = ""
    priority: str = "medium"          # low | medium | high
    status: str = "pending"           # pending | upcoming | currently_working | updation_needed
    assigned_to: Optional[str] = ""
    due_date: Optional[str] = None    # ISO date string YYYY-MM-DD
    team_id: Optional[str] = None     # optional team association


class UpdateTaskRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    assigned_to: Optional[str] = None
    due_date: Optional[str] = None
    team_id: Optional[str] = None
