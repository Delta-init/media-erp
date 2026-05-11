from typing import Optional
from pydantic import BaseModel, Field

from app.models.role import MODULES, ACTIONS, default_permissions


class ModulePermissions(BaseModel):
    view: bool = False
    create: bool = False
    edit: bool = False
    delete: bool = False
    export: bool = False


def _default_perm_dict():
    return {m: ModulePermissions() for m in MODULES}


class CreateRoleRequest(BaseModel):
    role_name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = ""
    permissions: Optional[dict[str, ModulePermissions]] = None


class UpdateRoleRequest(BaseModel):
    role_name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    permissions: Optional[dict[str, ModulePermissions]] = None
