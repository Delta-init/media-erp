"""
Project / Kanban task service.

Collection: project_tasks
"""

from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

VALID_STATUSES = {"pending", "upcoming", "currently_working", "updation_needed"}
VALID_PRIORITIES = {"low", "medium", "high"}


def _serialize(doc: dict) -> dict:
    out = {**doc}
    out["id"] = str(doc["_id"])
    del out["_id"]
    if "created_at" in out and hasattr(out["created_at"], "isoformat"):
        out["created_at"] = out["created_at"].isoformat()
    if "updated_at" in out and hasattr(out["updated_at"], "isoformat"):
        out["updated_at"] = out["updated_at"].isoformat()
    return out


async def list_tasks(
    db: AsyncIOMotorDatabase,
    search: str = "",
    status: str = "",
    priority: str = "",
    date_filter: str = "",        # today|this_week|this_month|this_year|custom
    date_from: str = "",
    date_to: str = "",
) -> list[dict]:
    query: dict[str, Any] = {}

    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
        ]

    if status and status in VALID_STATUSES:
        query["status"] = status

    if priority and priority in VALID_PRIORITIES:
        query["priority"] = priority

    # Date filtering on created_at
    now = datetime.now(timezone.utc)
    if date_filter == "today":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        query["created_at"] = {"$gte": start}
    elif date_filter == "this_week":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        start = start.replace(day=start.day - start.weekday())
        query["created_at"] = {"$gte": start}
    elif date_filter == "this_month":
        start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        query["created_at"] = {"$gte": start}
    elif date_filter == "this_year":
        start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        query["created_at"] = {"$gte": start}
    elif date_filter == "custom" and date_from and date_to:
        try:
            df = datetime.strptime(date_from, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            dt = datetime.strptime(date_to, "%Y-%m-%d").replace(
                hour=23, minute=59, second=59, tzinfo=timezone.utc
            )
            query["created_at"] = {"$gte": df, "$lte": dt}
        except ValueError:
            pass

    cursor = db["project_tasks"].find(query).sort("created_at", -1)
    docs = await cursor.to_list(length=500)
    return [_serialize(doc) for doc in docs]


async def create_task(db: AsyncIOMotorDatabase, data: dict) -> dict:
    now = datetime.now(timezone.utc)
    doc = {
        "title": data["title"],
        "description": data.get("description", ""),
        "priority": data.get("priority", "medium"),
        "status": data.get("status", "pending"),
        "assigned_to": data.get("assigned_to", ""),
        "due_date": data.get("due_date"),
        "created_by": data.get("created_by", ""),
        "created_at": now,
        "updated_at": now,
    }
    result = await db["project_tasks"].insert_one(doc)
    doc["_id"] = result.inserted_id
    return _serialize(doc)


async def update_task(
    db: AsyncIOMotorDatabase, task_id: str, updates: dict
) -> dict | None:
    try:
        oid = ObjectId(task_id)
    except Exception:
        return None

    updates = {k: v for k, v in updates.items() if v is not None}
    updates["updated_at"] = datetime.now(timezone.utc)

    result = await db["project_tasks"].find_one_and_update(
        {"_id": oid},
        {"$set": updates},
        return_document=True,
    )
    return _serialize(result) if result else None


async def delete_task(db: AsyncIOMotorDatabase, task_id: str) -> bool:
    try:
        oid = ObjectId(task_id)
    except Exception:
        return False
    result = await db["project_tasks"].delete_one({"_id": oid})
    return result.deleted_count > 0
