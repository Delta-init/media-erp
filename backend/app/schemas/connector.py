from datetime import datetime
from typing import Optional
from pydantic import BaseModel, field_validator

from app.models.connector import PLATFORMS, SYNC_FREQUENCIES


class ConnectorCreate(BaseModel):
    platform: str
    name: str
    sync_frequency: str = "daily"

    @field_validator("platform")
    @classmethod
    def validate_platform(cls, v: str) -> str:
        if v not in PLATFORMS:
            raise ValueError(f"platform must be one of {sorted(PLATFORMS)}")
        return v

    @field_validator("sync_frequency")
    @classmethod
    def validate_frequency(cls, v: str) -> str:
        if v not in SYNC_FREQUENCIES:
            raise ValueError(f"sync_frequency must be one of {sorted(SYNC_FREQUENCIES)}")
        return v


class ConnectorUpdate(BaseModel):
    name: Optional[str] = None
    sync_frequency: Optional[str] = None

    @field_validator("sync_frequency")
    @classmethod
    def validate_frequency(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in SYNC_FREQUENCIES:
            raise ValueError(f"sync_frequency must be one of {sorted(SYNC_FREQUENCIES)}")
        return v


def _dt(val: Optional[datetime]) -> Optional[str]:
    return val.isoformat() if val else None


def connector_to_out(doc: dict) -> dict:
    """Serialize a connector MongoDB document to a JSON-safe dict (no tokens)."""
    return {
        "id": str(doc["_id"]),
        "user_id": doc["user_id"],
        "platform": doc["platform"],
        "name": doc["name"],
        "status": doc["status"],
        "sync_frequency": doc["sync_frequency"],
        "last_synced_at": _dt(doc.get("last_synced_at")),
        "token_expires_at": _dt(doc.get("token_expires_at")),
        "platform_account_id": doc.get("platform_account_id"),
        "error_message": doc.get("error_message"),
        "created_at": _dt(doc.get("created_at")),
        "updated_at": _dt(doc.get("updated_at")),
    }
