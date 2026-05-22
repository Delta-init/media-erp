"""Audit logging utility — Feature 16."""
import logging
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)

async def log_audit_event(
    db: AsyncIOMotorDatabase,
    user_id: str,
    action: str,
    resource_type: str,
    resource_id: str | None = None,
    details: dict | None = None,
    ip_address: str | None = None,
) -> None:
    """Log an audit event. Silently swallows errors to never break callers."""
    try:
        await db["audit_logs"].insert_one({
            "user_id": user_id,
            "action": action,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "details": details or {},
            "ip_address": ip_address,
            "created_at": datetime.now(timezone.utc),
        })
    except Exception as exc:
        logger.error("audit_log failed: %s", exc)
