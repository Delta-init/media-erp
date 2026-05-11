from datetime import datetime, timezone
from bson import ObjectId


def notification_doc(
    user_id: str,
    notification_type: str,
    title: str,
    message: str,
    metadata: dict | None = None,
) -> dict:
    """Build a notification document ready for insert_one()."""
    return {
        "user_id": ObjectId(user_id),
        "type": notification_type,       # "sync_success" | "sync_error" | "info"
        "title": title,
        "message": message,
        "read": False,
        "metadata": metadata or {},
        "created_at": datetime.now(timezone.utc),
    }
