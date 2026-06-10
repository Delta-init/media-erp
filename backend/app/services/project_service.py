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
    # Serialize nested datetime objects inside timing intervals
    if out.get("timing"):
        timing = out["timing"]
        serialized_intervals = []
        for iv in timing.get("intervals", []):
            sa = iv.get("started_at")
            ea = iv.get("ended_at")
            serialized_intervals.append({
                "started_at": sa.isoformat() if hasattr(sa, "isoformat") else sa,
                "ended_at": ea.isoformat() if hasattr(ea, "isoformat") else ea,
            })
        out["timing"] = {
            "intervals": serialized_intervals,
            "total_seconds": timing.get("total_seconds"),
        }
    return out


async def list_tasks(
    db: AsyncIOMotorDatabase,
    search: str = "",
    status: str = "",
    priority: str = "",
    date_filter: str = "",        # today|this_week|this_month|this_year|custom
    date_from: str = "",
    date_to: str = "",
    team_id: str = "",
    # Visibility: "all" | "team" | "leader_teams" | "own"
    visibility: str = "all",
    user_id: str = "",
    leader_team_ids: list = None,  # set when visibility == "leader_teams"
) -> list[dict]:
    query: dict[str, Any] = {}

    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
        ]

    # Status is now dynamic (custom Kanban columns) — accept any non-empty key
    if status:
        query["status"] = status

    if priority and priority in VALID_PRIORITIES:
        query["priority"] = priority

    # Team filter
    if team_id:
        query["team_id"] = team_id

    # Visibility filter (role-based)
    if visibility == "own" and user_id:
        query["assigned_to"] = user_id
    elif visibility == "leader_teams" and leader_team_ids:
        # Team Leader with no explicit team_id — scope to all teams they lead
        query["team_id"] = {"$in": leader_team_ids}
    # "team"  → team_id already applied above (leader sees all tasks in that specific team)
    # "all"   → no additional filter (Super Admin / Admin / Coordinator)

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
        "assigned_to_name": data.get("assigned_to_name", ""),
        "due_date": data.get("due_date"),
        "team_id": data.get("team_id") or None,
        "attachments": data.get("attachments") or [],
        "created_by": data.get("created_by", ""),
        "created_at": now,
        "updated_at": now,
        "timing": {"intervals": [], "total_seconds": None},
        # Pipeline tracing (optional)
        "pipeline_id": data.get("pipeline_id") or None,
        "pipeline_node_id": data.get("pipeline_node_id") or None,
        "pipeline_parent_task_id": data.get("pipeline_parent_task_id") or None,
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
