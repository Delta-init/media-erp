"""
Media Schedule — CRUD endpoints for media team task scheduling.
"""
from datetime import datetime, timezone, timedelta
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel

from app.database import get_db
from app.middleware.auth import get_current_user
from app.utils.response import error_response, success_response

router = APIRouter(prefix="/api/v1/media-schedule", tags=["media-schedule"])


# ── Pydantic models ────────────────────────────────────────────────────────────

class MediaTaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    team_id: str
    assigned_to: str
    start_date: str   # YYYY-MM-DD
    due_date: str     # YYYY-MM-DD
    priority: str = "medium"   # low | medium | high


class MediaTaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    team_id: Optional[str] = None
    assigned_to: Optional[str] = None
    start_date: Optional[str] = None
    due_date: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None


# ── Helpers ────────────────────────────────────────────────────────────────────

def _parse_date(s: str) -> datetime:
    return datetime.strptime(s, "%Y-%m-%d").replace(tzinfo=timezone.utc)


def _serialize(doc: dict) -> dict:
    out = dict(doc)
    out["id"] = str(doc["_id"])
    del out["_id"]
    for field in ("start_date", "due_date", "created_at", "updated_at"):
        if field in out and hasattr(out[field], "isoformat"):
            out[field] = out[field].isoformat()
    return out


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.post("/tasks")
async def create_task(
    body: MediaTaskCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    try:
        start = _parse_date(body.start_date)
        due = _parse_date(body.due_date)
    except ValueError:
        return error_response("start_date and due_date must be YYYY-MM-DD", status_code=422)

    if due < start:
        return error_response("due_date must be on or after start_date", status_code=422)

    now = datetime.now(timezone.utc)
    doc = {
        "title": body.title.strip(),
        "description": body.description,
        "team_id": body.team_id,
        "assigned_to": body.assigned_to,
        "start_date": start,
        "due_date": due,
        "priority": body.priority,
        "status": "scheduled",
        "created_by": str(current_user["_id"]),
        "created_at": now,
        "updated_at": now,
    }
    result = await db["media_tasks"].insert_one(doc)
    doc["_id"] = result.inserted_id
    return success_response(_serialize(doc), "Task created")


@router.get("/tasks")
async def list_tasks(
    team_id: Optional[str] = None,
    assigned_to: Optional[str] = None,
    status: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    filt: dict = {}
    if team_id:
        filt["team_id"] = team_id
    if assigned_to:
        filt["assigned_to"] = assigned_to
    if status:
        filt["status"] = status

    if from_date or to_date:
        try:
            range_filt: dict = {}
            if from_date:
                range_filt["$gte"] = _parse_date(from_date)
            if to_date:
                range_filt["$lte"] = _parse_date(to_date) + timedelta(days=1)
            if range_filt:
                filt["$or"] = [
                    {"start_date": range_filt},
                    {"due_date": range_filt},
                ]
        except ValueError:
            pass

    cursor = db["media_tasks"].find(filt).sort("start_date", 1)
    docs = await cursor.to_list(length=500)
    return success_response(
        {"tasks": [_serialize(d) for d in docs], "total": len(docs)},
        "Tasks retrieved",
    )


@router.patch("/tasks/{task_id}")
async def update_task(
    task_id: str,
    body: MediaTaskUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    try:
        oid = ObjectId(task_id)
    except Exception:
        return error_response("Invalid task ID", status_code=422)

    task = await db["media_tasks"].find_one({"_id": oid})
    if not task:
        return error_response("Task not found", status_code=404)

    update: dict = {"updated_at": datetime.now(timezone.utc)}
    for field in ("title", "description", "team_id", "assigned_to", "priority", "status"):
        v = getattr(body, field)
        if v is not None:
            update[field] = v

    for date_field in ("start_date", "due_date"):
        v = getattr(body, date_field)
        if v:
            try:
                update[date_field] = _parse_date(v)
            except ValueError:
                return error_response(f"{date_field} must be YYYY-MM-DD", status_code=422)

    await db["media_tasks"].update_one({"_id": oid}, {"$set": update})
    updated = await db["media_tasks"].find_one({"_id": oid})
    return success_response(_serialize(updated), "Task updated")


@router.delete("/tasks/{task_id}")
async def cancel_task(
    task_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    try:
        oid = ObjectId(task_id)
    except Exception:
        return error_response("Invalid task ID", status_code=422)

    result = await db["media_tasks"].update_one(
        {"_id": oid},
        {"$set": {"status": "cancelled", "updated_at": datetime.now(timezone.utc)}},
    )
    if result.matched_count == 0:
        return error_response("Task not found", status_code=404)
    return success_response(None, "Task cancelled")
