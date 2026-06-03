"""
Projects / Kanban router.

Visibility rules:
  - Super admin (role="admin"):  sees ALL tasks
  - Team leader:                 sees all tasks in their teams
  - Regular member:              sees only tasks assigned to them

Endpoints
---------
  GET    /api/v1/projects          — list tasks (visibility-filtered)
  POST   /api/v1/projects          — create task
  PUT    /api/v1/projects/{id}     — update task / move column
  DELETE /api/v1/projects/{id}     — delete task
"""

from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.database import get_db
from app.middleware.auth import get_current_user
from app.schemas.project import CreateTaskRequest, UpdateTaskRequest
from app.services.project_service import (
    create_task,
    delete_task,
    list_tasks,
    update_task,
)
from app.utils.response import error_response, success_response

router = APIRouter(prefix="/api/v1/projects", tags=["projects"])


async def _resolve_visibility(current_user: dict, team_id: str, db: AsyncIOMotorDatabase):
    """Return visibility level based on user's role and team membership."""
    uid = str(current_user["_id"])

    # Super admin sees everything
    if current_user.get("role") == "admin":
        return "all", uid

    # If a specific team is requested, check membership
    if team_id:
        team = await db["teams"].find_one({"_id_str": team_id})
        if not team:
            # Try by string id matching
            from bson import ObjectId
            from bson.errors import InvalidId
            try:
                team = await db["teams"].find_one({"_id": ObjectId(team_id)})
            except InvalidId:
                team = None
        if team:
            for m in team.get("members", []):
                if m["user_id"] == uid:
                    if m["role"] == "leader":
                        return "team", uid   # leader sees all team tasks
                    else:
                        return "own", uid    # member sees only own tasks
        return "own", uid

    # No team filter — check if user is leader in ANY team
    is_leader_somewhere = await db["teams"].find_one(
        {"members": {"$elemMatch": {"user_id": uid, "role": "leader"}}}
    )
    if is_leader_somewhere:
        return "all", uid   # leaders see all tasks across their teams (filtered further by team_id)

    return "own", uid


@router.get("")
async def get_tasks(
    search: str = Query(default=""),
    status: str = Query(default=""),
    priority: str = Query(default=""),
    date_filter: str = Query(default=""),
    date_from: str = Query(default=""),
    date_to: str = Query(default=""),
    team_id: str = Query(default=""),
    member_id: str = Query(default=""),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    visibility, uid = await _resolve_visibility(current_user, team_id, db)

    # Member filter — only allowed for admins or team leaders.
    # A regular member is locked to their own tasks regardless of this param.
    if member_id and visibility in ("all", "team"):
        visibility = "own"      # reuse own-filter logic
        uid = member_id         # but scope to the requested member

    tasks = await list_tasks(
        db,
        search=search,
        status=status,
        priority=priority,
        date_filter=date_filter,
        date_from=date_from,
        date_to=date_to,
        team_id=team_id,
        visibility=visibility,
        user_id=uid,
    )
    return success_response(data=tasks, message="Tasks retrieved")


@router.post("", status_code=201)
async def add_task(
    body: CreateTaskRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    data = body.model_dump()
    data["created_by"] = str(current_user["_id"])
    task = await create_task(db, data)
    return success_response(data=task, message="Task created", status_code=201)


@router.put("/{task_id}")
async def edit_task(
    task_id: str,
    body: UpdateTaskRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    task = await update_task(db, task_id, body.model_dump(exclude_none=True))
    if not task:
        return error_response("Task not found", status_code=404)
    return success_response(data=task, message="Task updated")


@router.delete("/{task_id}", status_code=204)
async def remove_task(
    task_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    deleted = await delete_task(db, task_id)
    if not deleted:
        return error_response("Task not found", status_code=404)
    return None
