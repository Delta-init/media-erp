from typing import Optional
from pydantic import BaseModel


class CreateTeamRequest(BaseModel):
    name: str
    description: Optional[str] = ""
    color: Optional[str] = "#6366f1"   # indigo default


class UpdateTeamRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None


class AddMemberRequest(BaseModel):
    user_id: str
    role: str = "member"   # "member" | "leader"


class UpdateMemberRoleRequest(BaseModel):
    role: str              # "member" | "leader"
