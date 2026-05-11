from datetime import datetime, timezone
from bson import ObjectId
from app.database import get_db


async def get_messages(
    user_a: str,
    user_b: str,
    limit: int = 50,
    before_id: str | None = None,
) -> list[dict]:
    db = get_db()
    query: dict = {
        "$or": [
            {"from_user_id": user_a, "to_user_id": user_b},
            {"from_user_id": user_b, "to_user_id": user_a},
        ]
    }
    if before_id:
        query["_id"] = {"$lt": ObjectId(before_id)}

    cursor = db["messages"].find(query).sort("_id", -1).limit(limit)
    docs = await cursor.to_list(limit)
    return list(reversed(docs))  # chronological order


async def save_message(from_user_id: str, to_user_id: str, content: str) -> dict:
    db = get_db()
    doc = {
        "from_user_id": from_user_id,
        "to_user_id": to_user_id,
        "content": content,
        "read": False,
        "created_at": datetime.now(timezone.utc),
    }
    result = await db["messages"].insert_one(doc)
    doc["_id"] = result.inserted_id
    return doc


async def mark_read(from_user_id: str, to_user_id: str) -> None:
    """Mark all messages from `from_user_id` to `to_user_id` as read."""
    db = get_db()
    await db["messages"].update_many(
        {"from_user_id": from_user_id, "to_user_id": to_user_id, "read": False},
        {"$set": {"read": True}},
    )


async def unread_counts(user_id: str) -> dict[str, int]:
    """Return {sender_id: unread_count} for the given recipient."""
    db = get_db()
    pipeline = [
        {"$match": {"to_user_id": user_id, "read": False}},
        {"$group": {"_id": "$from_user_id", "count": {"$sum": 1}}},
    ]
    results = await db["messages"].aggregate(pipeline).to_list(None)
    return {r["_id"]: r["count"] for r in results}
