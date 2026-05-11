from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class UserDocument(BaseModel):
    """Shape of a user record read from MongoDB."""

    id: Optional[str] = Field(default=None, alias="_id")
    email: EmailStr
    hashed_password: str
    name: str
    role: str = "user"           # "user" | "admin"
    plan: str = "free"           # "free" | "pro" | "enterprise"
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = {"populate_by_name": True}


def user_doc_to_dict(
    email: str,
    hashed_password: str,
    name: str,
    role_id: str = "",
    designation: str = "",
    status: str = "active",
) -> dict:
    """Build a new user dict ready for `db['users'].insert_one()`."""
    now = datetime.now(timezone.utc)
    return {
        "email": email,
        "hashed_password": hashed_password,
        "name": name,
        "role": "user",          # legacy string kept for compatibility
        "plan": "free",
        "is_active": status == "active",
        "role_id": role_id,      # ObjectId string — points to roles collection
        "designation": designation,
        "status": status,        # "active" | "inactive"
        "created_at": now,
        "updated_at": now,
    }
