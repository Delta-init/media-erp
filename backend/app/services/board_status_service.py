"""
Board status (Kanban column) service.

Collection: board_statuses
Each document defines one Kanban column shared across the workspace.

Fields:
  key        : stable slug used as task.status   (e.g. "in_review")
  label      : display name                        (e.g. "In Review")
  color      : hex colour                          (e.g. "#3b82f6")
  position   : ordering index (ascending)
  is_default : True for the four seeded columns (still editable/deletable)
"""

import re
from datetime import datetime, timezone

from bson import ObjectId
from bson.errors import InvalidId
from motor.motor_asyncio import AsyncIOMotorDatabase

# Seeded on first access so existing tasks keep their columns.
DEFAULT_STATUSES = [
    {"key": "pending",           "label": "Pending",           "color": "#eab308", "position": 0},
    {"key": "upcoming",          "label": "Upcoming",          "color": "#3b82f6", "position": 1},
    {"key": "currently_working", "label": "Currently Working", "color": "#22c55e", "position": 2},
    {"key": "updation_needed",   "label": "Updation Needed",   "color": "#ef4444", "position": 3},
]


def _serialize(doc: dict) -> dict:
    return {
        "id":         str(doc["_id"]),
        "key":        doc["key"],
        "label":      doc["label"],
        "color":      doc.get("color", "#6366f1"),
        "position":   doc.get("position", 0),
        "is_default": doc.get("is_default", False),
    }


def _slugify(label: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", label.strip().lower()).strip("_")
    return slug or "status"


async def _ensure_seeded(db: AsyncIOMotorDatabase) -> None:
    count = await db["board_statuses"].count_documents({})
    if count == 0:
        now = datetime.now(timezone.utc)
        docs = [
            {**s, "is_default": True, "created_at": now, "updated_at": now}
            for s in DEFAULT_STATUSES
        ]
        await db["board_statuses"].insert_many(docs)


async def list_statuses(db: AsyncIOMotorDatabase) -> list[dict]:
    await _ensure_seeded(db)
    cursor = db["board_statuses"].find({}).sort("position", 1)
    docs = await cursor.to_list(length=200)
    return [_serialize(d) for d in docs]


async def _unique_key(db: AsyncIOMotorDatabase, base: str) -> str:
    key = base
    n = 1
    while await db["board_statuses"].find_one({"key": key}):
        n += 1
        key = f"{base}_{n}"
    return key


async def create_status(db: AsyncIOMotorDatabase, label: str, color: str) -> dict:
    await _ensure_seeded(db)
    now = datetime.now(timezone.utc)
    key = await _unique_key(db, _slugify(label))

    # Append at the end
    last = await db["board_statuses"].find_one({}, sort=[("position", -1)])
    position = (last["position"] + 1) if last else 0

    doc = {
        "key": key,
        "label": label.strip(),
        "color": color or "#6366f1",
        "position": position,
        "is_default": False,
        "created_at": now,
        "updated_at": now,
    }
    result = await db["board_statuses"].insert_one(doc)
    doc["_id"] = result.inserted_id
    return _serialize(doc)


async def update_status(db: AsyncIOMotorDatabase, status_id: str, updates: dict) -> dict | None:
    try:
        oid = ObjectId(status_id)
    except InvalidId:
        return None
    clean = {k: v for k, v in updates.items() if v is not None and k in ("label", "color", "position")}
    if "label" in clean:
        clean["label"] = clean["label"].strip()
    clean["updated_at"] = datetime.now(timezone.utc)
    doc = await db["board_statuses"].find_one_and_update(
        {"_id": oid}, {"$set": clean}, return_document=True
    )
    return _serialize(doc) if doc else None


async def delete_status(db: AsyncIOMotorDatabase, status_id: str) -> tuple[bool, str | None]:
    """
    Delete a column. Tasks in it are reassigned to the first remaining column.
    Returns (success, error_message).
    """
    try:
        oid = ObjectId(status_id)
    except InvalidId:
        return False, "Invalid status ID"

    target = await db["board_statuses"].find_one({"_id": oid})
    if not target:
        return False, "Status not found"

    total = await db["board_statuses"].count_documents({})
    if total <= 1:
        return False, "Cannot delete the last remaining column"

    # Pick a fallback column (first by position that isn't this one)
    fallback = await db["board_statuses"].find_one(
        {"_id": {"$ne": oid}}, sort=[("position", 1)]
    )
    fallback_key = fallback["key"] if fallback else "pending"

    # Reassign tasks then delete the column
    await db["project_tasks"].update_many(
        {"status": target["key"]},
        {"$set": {"status": fallback_key, "updated_at": datetime.now(timezone.utc)}},
    )
    await db["board_statuses"].delete_one({"_id": oid})
    return True, None


async def reorder_statuses(db: AsyncIOMotorDatabase, ordered_ids: list[str]) -> list[dict]:
    now = datetime.now(timezone.utc)
    for pos, sid in enumerate(ordered_ids):
        try:
            oid = ObjectId(sid)
        except InvalidId:
            continue
        await db["board_statuses"].update_one(
            {"_id": oid}, {"$set": {"position": pos, "updated_at": now}}
        )
    return await list_statuses(db)
