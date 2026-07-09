from typing import Optional, Literal
from pydantic import BaseModel, EmailStr, Field


class CreateUserRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=6)
    role_id: str
    designation: Optional[str] = ""
    status: Literal["active", "inactive"] = "active"
    whatsapp_phone: Optional[str] = ""


class UpdateUserRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(None, min_length=6)
    role_id: Optional[str] = None
    designation: Optional[str] = None
    status: Optional[Literal["active", "inactive"]] = None
    whatsapp_phone: Optional[str] = None
