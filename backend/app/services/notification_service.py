"""
Notification service — Phase 7.2.

Provides helpers used by:
  - sync_service (Celery, synchronous PyMongo)
  - notifications router (FastAPI, async Motor)
"""
from datetime import datetime, timezone

from bson import ObjectId
from bson.errors import InvalidId

from app.models.notification import notification_doc


# ── Sync helpers (used by Celery / sync_service) ─────────────────────────────

def create_notification_sync(
    db,
    user_id: str,
    notification_type: str,
    title: str,
    message: str,
    metadata: dict | None = None,
) -> str:
    """Insert a notification using a synchronous PyMongo client."""
    doc = notification_doc(user_id, notification_type, title, message, metadata)
    result = db["notifications"].insert_one(doc)
    return str(result.inserted_id)


# ── Async helpers (used by FastAPI router) ────────────────────────────────────

async def list_notifications(
    db,
    user_id: str,
    limit: int = 20,
    unread_only: bool = False,
) -> dict:
    """Return paginated notifications for a user, newest first."""
    query: dict = {"user_id": ObjectId(user_id)}
    if unread_only:
        query["read"] = False

    cursor = db["notifications"].find(query).sort("created_at", -1).limit(limit)
    items = []
    async for doc in cursor:
        items.append({
            "id": str(doc["_id"]),
            "type": doc["type"],
            "title": doc["title"],
            "message": doc["message"],
            "read": doc["read"],
            "metadata": doc.get("metadata", {}),
            "created_at": doc["created_at"].isoformat(),
        })

    total_unread = await db["notifications"].count_documents(
        {"user_id": ObjectId(user_id), "read": False}
    )
    return {"items": items, "unread_count": total_unread}


async def mark_read(db, notification_id: str, user_id: str) -> bool:
    """Mark a single notification as read. Returns True if found+updated."""
    try:
        oid = ObjectId(notification_id)
    except InvalidId:
        return False

    result = await db["notifications"].update_one(
        {"_id": oid, "user_id": ObjectId(user_id)},
        {"$set": {"read": True}},
    )
    return result.matched_count > 0


async def mark_all_read(db, user_id: str) -> int:
    """Mark all notifications for a user as read. Returns count modified."""
    result = await db["notifications"].update_many(
        {"user_id": ObjectId(user_id), "read": False},
        {"$set": {"read": True}},
    )
    return result.modified_count
