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
    """
    Return (visibility, uid, leader_team_ids).

    visibility levels
    -----------------
    "all"          → no restriction (Super Admin / Admin / Coordinator)
    "team"         → all tasks in one specific team (Team Leader of that team)
    "leader_teams" → tasks in every team the caller leads (Team Leader, no team_id filter)
    "own"          → only tasks assigned to uid (Employee / member)

    leader_team_ids is set only when visibility == "leader_teams".
    """
    from bson import ObjectId
    from bson.errors import InvalidId

    uid       = str(current_user["_id"])
    role_doc  = current_user.get("_role") or {}
    role_name = role_doc.get("role_name", "")

    # ── Elevated roles see everything ─────────────────────────────────────────
    if role_name in ("Super Admin", "Admin", "Coordinator"):
        return "all", uid, None

    # ── Team Leader — scoped to teams they lead ───────────────────────────────
    if role_name == "Team Leader":
        if team_id:
            # Specific team requested — check whether they lead it
            try:
                team = await db["teams"].find_one({"_id": ObjectId(team_id)})
            except (InvalidId, Exception):
                team = None
            if team:
                for m in team.get("members", []):
                    if m["user_id"] == uid:
                        if m["role"] == "leader":
                            return "team", uid, None    # sees all tasks in that team
                        else:
                            return "own", uid, None     # member → own tasks only
            return "own", uid, None
        else:
            # No team filter — collect all teams where they are leader
            leader_teams = await db["teams"].find(
                {"members": {"$elemMatch": {"user_id": uid, "role": "leader"}}}
            ).to_list(500)
            if leader_teams:
                ids = [str(t["_id"]) for t in leader_teams]
                return "leader_teams", uid, ids
            return "own", uid, None

    # ── Employee / other — own tasks only ─────────────────────────────────────
    return "own", uid, None


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
    visibility, uid, leader_team_ids = await _resolve_visibility(current_user, team_id, db)

    # Member filter — only allowed for elevated roles or team leaders.
    # A regular member is locked to their own tasks regardless of this param.
    if member_id and visibility in ("all", "team", "leader_teams"):
        visibility       = "own"   # reuse own-filter logic
        uid              = member_id
        leader_team_ids  = None    # clear team scope

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
        leader_team_ids=leader_team_ids or [],
    )
    return success_response(data=tasks, message="Tasks retrieved")


@router.post("", status_code=201)
async def add_task(
    body: CreateTaskRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    from app.services import workflow

    data = body.model_dump()
    data["created_by"] = str(current_user["_id"])
    data["status"] = "pending"  # new work always enters the workflow at Pending

    # Members can only create tasks for themselves; only admins / team leaders
    # may assign work to someone else.
    if not await workflow.can_assign_to_others(current_user, data.get("team_id"), db):
        data["assigned_to"] = str(current_user["_id"])
        data["assigned_to_name"] = current_user.get("name", "")

    task = await create_task(db, data)
    return success_response(data=task, message="Task created", status_code=201)


@router.get("/leader/queue")
async def leader_queue(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Leader Desk feed (team leaders + admins):
      - review:   pending_review tasks from teams the user leads
      - incoming: new (pending) work in those teams that is unassigned or
                  assigned to the leader — to distribute to members
      - teams:    the led teams with their members (for the assign dropdown)
    """
    from bson import ObjectId
    from app.services.project_service import _serialize

    uid = str(current_user["_id"])
    role_doc   = current_user.get("_role") or {}
    role_name  = role_doc.get("role_name", "")
    # SA / Admin / Coordinator see all teams' queues; Team Leaders see only their led teams
    is_elevated = role_name in ("Super Admin", "Admin", "Coordinator")

    if is_elevated:
        teams = await db["teams"].find({}).to_list(500)
    else:
        teams = await db["teams"].find(
            {"members": {"$elemMatch": {"user_id": uid, "role": "leader"}}}
        ).to_list(500)

    if not teams:
        return success_response(
            data={"is_leader": is_elevated, "review": [], "incoming": [], "teams": []},
            message="Leader queue",
        )

    team_ids = [str(t["_id"]) for t in teams]

    # Resolve member names for the assign dropdown
    member_ids = {m["user_id"] for t in teams for m in t.get("members", [])}
    valid = [ObjectId(i) for i in member_ids if ObjectId.is_valid(i)]
    users = await db["users"].find({"_id": {"$in": valid}}, {"name": 1, "email": 1}).to_list(1000)
    name_map = {str(u["_id"]): (u.get("name") or u.get("email", "")) for u in users}

    teams_out = [{
        "id": str(t["_id"]),
        "name": t.get("name", ""),
        "color": t.get("color", "#6366f1"),
        "members": [
            {"id": m["user_id"], "name": name_map.get(m["user_id"], ""), "role": m.get("role", "member")}
            for m in t.get("members", [])
        ],
    } for t in teams]

    review = await db["project_tasks"].find(
        {"status": "pending_review", "team_id": {"$in": team_ids}}
    ).sort("updated_at", -1).to_list(500)

    incoming = await db["project_tasks"].find({
        "status": "pending",
        "team_id": {"$in": team_ids},
        "$or": [{"assigned_to": {"$in": ["", None]}}, {"assigned_to": uid}],
    }).sort("created_at", -1).to_list(500)

    return success_response(
        data={
            "is_leader": True,
            "review":   [_serialize(t) for t in review],
            "incoming": [_serialize(t) for t in incoming],
            "teams":    teams_out,
        },
        message="Leader queue",
    )


# ── Pipeline child-task helper ─────────────────────────────────────────────────

async def _create_pipeline_child(
    db,
    parent_task: dict,
    pipeline_id: str,
    target_node_id: str,
    target_team_id: str,
) -> None:
    """Create a new pending task in the next pipeline team."""
    from datetime import datetime, timezone as tz
    now = datetime.now(tz.utc)
    doc = {
        "title": parent_task["title"],
        "description": parent_task.get("description", ""),
        "priority": parent_task.get("priority", "medium"),
        "status": "pending",
        "assigned_to": "",
        "assigned_to_name": "",
        "due_date": None,
        "team_id": target_team_id,
        "attachments": [],
        "created_by": parent_task.get("created_by", ""),
        "created_at": now,
        "updated_at": now,
        "timing": {"intervals": [], "total_seconds": None},
        "pipeline_id": pipeline_id,
        "pipeline_node_id": target_node_id,
        "pipeline_parent_task_id": parent_task.get("id") or str(parent_task.get("_id", "")),
    }
    await db["project_tasks"].insert_one(doc)


# ── Manual pipeline-advance (branch selection) ─────────────────────────────────

@router.post("/{task_id}/pipeline-advance")
async def pipeline_advance(
    task_id: str,
    body: dict,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Called after the approver picks a branch in a multi-branch pipeline node.
    body: { "target_node_id": "n-xxx" }
    """
    from bson import ObjectId
    from bson.errors import InvalidId
    from app.services import workflow

    target_node_id = body.get("target_node_id")
    if not target_node_id:
        return error_response("target_node_id is required", status_code=400)

    try:
        oid = ObjectId(task_id)
    except InvalidId:
        return error_response("Invalid task ID", status_code=422)

    task = await db["project_tasks"].find_one({"_id": oid})
    if not task:
        return error_response("Task not found", status_code=404)

    if task.get("status") != "approved":
        return error_response("Task must be approved before advancing.", status_code=400)

    if not task.get("pipeline_id"):
        return error_response("Task is not part of a pipeline.", status_code=400)

    # Auth check — only leaders/admins may advance pipeline
    if not await workflow.can_approve(current_user, task, db):
        return error_response("Only a team leader can advance a pipeline task.", status_code=403)

    pipeline = await db["pipelines"].find_one({"_id": ObjectId(task["pipeline_id"])})
    if not pipeline:
        return error_response("Pipeline not found", status_code=404)

    target_node = next(
        (n for n in pipeline.get("nodes", []) if n["id"] == target_node_id), None
    )
    if not target_node:
        return error_response("Target node not found in pipeline.", status_code=404)

    # Create child task in chosen team
    from app.services.project_service import _serialize
    from datetime import datetime, timezone as tz
    now = datetime.now(tz.utc)
    child_doc = {
        "title": task["title"],
        "description": task.get("description", ""),
        "priority": task.get("priority", "medium"),
        "status": "pending",
        "assigned_to": "",
        "assigned_to_name": "",
        "due_date": None,
        "team_id": target_node["team_id"],
        "attachments": [],
        "created_by": task.get("created_by", ""),
        "created_at": now,
        "updated_at": now,
        "timing": {"intervals": [], "total_seconds": None},
        "pipeline_id": task["pipeline_id"],
        "pipeline_node_id": target_node_id,
        "pipeline_parent_task_id": str(task["_id"]),
    }
    result = await db["project_tasks"].insert_one(child_doc)
    child_doc["_id"] = result.inserted_id

    return success_response(
        data={"child_task": _serialize(child_doc)},
        message="Task advanced in pipeline",
    )


@router.put("/{task_id}")
async def edit_task(
    task_id: str,
    body: UpdateTaskRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    from bson import ObjectId
    from bson.errors import InvalidId
    from app.services import workflow

    updates = body.model_dump(exclude_none=True)
    new_status = updates.get("status")

    try:
        oid = ObjectId(task_id)
    except InvalidId:
        return error_response("Invalid task ID", status_code=422)
    current = await db["project_tasks"].find_one({"_id": oid})
    if not current:
        return error_response("Task not found", status_code=404)
    cur_status = current.get("status", "pending")

    # Enforce the workflow state machine on any status change
    if new_status and new_status != cur_status:
        if not workflow.is_allowed(cur_status, new_status):
            return error_response(workflow.transition_error(cur_status, new_status), status_code=400)
        # Approve / send-to-reedit (leaving pending_review) is leader/admin only
        if cur_status in workflow.LEADER_ONLY_FROM:
            if not await workflow.can_approve(current_user, current, db):
                return error_response(
                    "Only a team leader can approve a task or send it to reedit.",
                    status_code=403,
                )
        # Sending to reedit requires a reason
        if new_status == "reedit":
            if not (updates.get("reedit_reason") or "").strip():
                return error_response("Please add a reason for sending this task to reedit.", status_code=400)
        else:
            # leaving/entering any other state clears a stale reedit reason
            updates.setdefault("reedit_reason", "")
        # "one started task per person" — bump the assignee's other started task
        if new_status == "started":
            await workflow.bump_other_started(db, current)

        # Apply timing update for this transition
        from datetime import datetime, timezone as tz
        updates["timing"] = workflow.apply_timing(
            cur_status, new_status, current.get("timing"), datetime.now(tz.utc)
        )

    # Reassigning a task to someone else is a leader/admin action
    if "assigned_to" in updates and updates["assigned_to"] != current.get("assigned_to"):
        if not await workflow.can_assign_to_others(current_user, current.get("team_id"), db):
            return error_response("Only a team leader can assign tasks to others.", status_code=403)

    task = await update_task(db, task_id, updates)
    if not task:
        return error_response("Task not found", status_code=404)

    # ── Pipeline advancement (only on approve) ────────────────────────────────
    if new_status == "approved" and task.get("pipeline_id"):
        try:
            pipeline = await db["pipelines"].find_one(
                {"_id": ObjectId(task["pipeline_id"])}
            )
        except Exception:
            pipeline = None

        if pipeline:
            cur_node_id = task.get("pipeline_node_id")
            outgoing = [
                e for e in pipeline.get("edges", [])
                if e["source"] == cur_node_id
            ]

            if len(outgoing) == 1:
                # ── Single branch → auto-advance silently ─────────────────────
                tgt_nid  = outgoing[0]["target"]
                tgt_node = next(
                    (n for n in pipeline.get("nodes", []) if n["id"] == tgt_nid), None
                )
                if tgt_node:
                    await _create_pipeline_child(
                        db, task, str(pipeline["_id"]), tgt_nid, tgt_node["team_id"]
                    )
                task["_pipeline_auto_advanced"] = True

            elif len(outgoing) > 1:
                # ── Multiple branches → return options for approver to pick ───
                branches = []
                for edge in outgoing:
                    tgt_nid  = edge["target"]
                    tgt_node = next(
                        (n for n in pipeline.get("nodes", []) if n["id"] == tgt_nid), None
                    )
                    if not tgt_node:
                        continue
                    try:
                        team = await db["teams"].find_one(
                            {"_id": ObjectId(tgt_node["team_id"])}
                        )
                    except Exception:
                        team = None
                    branches.append({
                        "edge_id": edge["id"],
                        "target_node_id": tgt_nid,
                        "target_team_id": tgt_node["team_id"],
                        "target_team_name": team["name"] if team else "Unknown Team",
                        "edge_label": edge.get("label") or "",
                    })
                task["_pipeline_branches"] = branches

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
