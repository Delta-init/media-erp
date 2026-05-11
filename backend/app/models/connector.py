from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field

PLATFORMS = {"google_ads", "ga4", "facebook_ads", "linkedin_ads", "tiktok_ads"}
# linkedin_ads: Phase 3.8 | tiktok_ads: Phase 3.9
SYNC_FREQUENCIES = {"hourly", "daily", "manual"}
STATUSES = {"disconnected", "connected", "syncing", "error"}


class ConnectorDocument(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    user_id: str
    platform: str
    name: str
    status: str = "disconnected"
    sync_frequency: str = "daily"
    encrypted_access_token: Optional[str] = None
    encrypted_refresh_token: Optional[str] = None
    token_expires_at: Optional[datetime] = None
    last_synced_at: Optional[datetime] = None
    error_message: Optional[str] = None
    platform_account_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = {"populate_by_name": True}


def connector_doc(
    user_id: str,
    platform: str,
    name: str,
    sync_frequency: str = "daily",
) -> dict:
    """Build a new connector dict ready for `db['connectors'].insert_one()`."""
    now = datetime.now(timezone.utc)
    return {
        "user_id": user_id,
        "platform": platform,
        "name": name,
        "status": "disconnected",
        "sync_frequency": sync_frequency,
        "encrypted_access_token": None,
        "encrypted_refresh_token": None,
        "token_expires_at": None,
        "last_synced_at": None,
        "error_message": None,
        "platform_account_id": None,
        "created_at": now,
        "updated_at": now,
    }
