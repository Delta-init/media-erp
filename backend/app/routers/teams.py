"""
Teams router.

Endpoints
---------
  GET    /api/v1/teams                          — list teams the current user belongs to
  POST   /api/v1/teams                          — create team (creator becomes leader)
  GET    /api/v1/teams/{id}                     — team detail + members
  PUT    /api/v1/teams/{id}                     — update team info (leader / admin)
  DELETE /api/v1/teams/{id}                     — delete team (admin only)
  POST   /api/v1/teams/{id}/members             — add member (leader / admin)
  DELETE /api/v1/teams/{id}/members/{user_id}   — remove member (leader / admin)
  PUT    /api/v1/teams/{id}/members/{user_id}/role  — change member role
  GET    /api/v1/teams/{id}/members/{user_id}/report — member performance report
  GET    /api/v1/teams/all                      — admin: list ALL teams
"""

from datetime import datetime, timezone

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.database import get_db
from app.middleware.auth import get_current_user
from app.schemas.team import (
    AddMemberRequest,
    CreateTeamRequest,
    UpdateMemberRoleRequest,
    UpdateTeamRequest,
)
from app.utils.response import error_response, success_response

router = APIRouter(prefix="/api/v1/teams", tags=["teams"])

VALID_ROLES = {"member", "leader"}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _has_perm(user: dict, module: str, action: str) -> bool:
    """Check RBAC permission via the attached _role document."""
    role = user.get("_role") or {}
    # Super Admin always has full access
    if role.get("role_name") == "Super Admin":
        return True
    perms = role.get("permissions") or {}
    return bool(perms.get(module, {}).get(action, False))


def _can_see_all_teams(user: dict) -> bool:
    """True for all roles with teams.view (Super Admin, Admin, Coordinator, Team Leader)."""
    return _has_perm(user, "teams", "view")


def _can_manage_any_team(user: dict) -> bool:
    """
    True only for Super Admin, Admin, and Coordinator.
    Team Leaders can manage their OWN team but NOT every team.
    Uses teams.create as the proxy (Team Leader doesn't have it).
    """
    role = user.get("_role") or {}
    if role.get("role_name") == "Super Admin":
        return True
    perms = role.get("permissions") or {}
    return bool(perms.get("teams", {}).get("create", False))


def _is_leader_of(team: dict, user_id: str) -> bool:
    for m in team.get("members", []):
        if m["user_id"] == user_id and m["role"] == "leader":
            return True
    return False


def _can_manage(team: dict, user: dict) -> bool:
    """Elevated users (Super Admin/Admin/Coordinator) OR the team's own leader."""
    uid = str(user["_id"])
    return _can_manage_any_team(user) or _is_leader_of(team, uid)


def _serialize_team(doc: dict) -> dict:
    out = {**doc}
    out["id"] = str(doc["_id"])
    del out["_id"]
    for f in ("created_at", "updated_at"):
        if f in out and hasattr(out[f], "isoformat"):
            out[f] = out[f].isoformat()
    for m in out.get("members", []):
        if "joined_at" in m and hasattr(m["joined_at"], "isoformat"):
            m["joined_at"] = m["joined_at"].isoformat()
    return out


async def _get_team_or_404(db, team_id: str):
    try:
        oid = ObjectId(team_id)
    except InvalidId:
        return None, error_response("Invalid team ID", status_code=422)
    doc = await db["teams"].find_one({"_id": oid})
    if not doc:
        return None, error_response("Team not found", status_code=404)
    return doc, None


async def _enrich_members(db, members: list[dict]) -> list[dict]:
    """Attach name/email/designation to each member entry."""
    if not members:
        return []
    user_ids = [ObjectId(m["user_id"]) for m in members if ObjectId.is_valid(m["user_id"])]
    users = await db["users"].find({"_id": {"$in": user_ids}}).to_list(500)
    user_map = {str(u["_id"]): u for u in users}
    enriched = []
    for m in members:
        u = user_map.get(m["user_id"], {})
        enriched.append({
            **m,
            "name":        u.get("name", "Unknown"),
            "email":       u.get("email", ""),
            "designation": u.get("designation", ""),
            "avatar":      u.get("avatar", ""),
        })
    return enriched


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/all")
async def list_all_teams(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Super Admin / Admin / Coordinator: list every team."""
    if not _can_see_all_teams(current_user):
        return error_response("Insufficient permissions to view all teams", status_code=403)
    docs = await db["teams"].find({}).sort("created_at", -1).to_list(500)
    teams = []
    for d in docs:
        t = _serialize_team(d)
        t["member_count"] = len(d.get("members", []))
        teams.append(t)
    return success_response(data=teams, message="All teams retrieved")


@router.get("")
async def list_my_teams(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """List teams. Elevated roles (Super Admin/Admin/Coordinator) see all; others see only their own."""
    uid = str(current_user["_id"])
    if _can_see_all_teams(current_user):
        query = {}
    else:
        query = {"members.user_id": uid}
    docs = await db["teams"].find(query).sort("created_at", -1).to_list(500)
    teams = []
    for d in docs:
        t = _serialize_team(d)
        t["member_count"] = len(d.get("members", []))
        tid = str(d["_id"])
        t["task_count"] = await db["project_tasks"].count_documents({"team_id": tid})
        t["done_count"] = await db["project_tasks"].count_documents(
            {"team_id": tid, "status": "currently_working"}
        )
        # Caller's role in this team
        for m in d.get("members", []):
            if m["user_id"] == uid:
                t["my_role"] = m["role"]
                break
        else:
            t["my_role"] = "admin" if _can_manage_any_team(current_user) else "member"
        teams.append(t)
    return success_response(data=teams, message="Teams retrieved")


@router.get("/users")
async def list_assignable_users(
    search: str = "",
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Minimal directory of users for building teams (leader/member pickers).
    Available to any authenticated user so team leaders can add members even
    without the global users:view permission. Returns only non-sensitive fields.
    """
    query: dict = {}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
        ]
    docs = await db["users"].find(
        query, {"name": 1, "email": 1, "designation": 1, "avatar": 1, "status": 1, "role_id": 1}
    ).sort("name", 1).to_list(500)

    # Resolve role names in a single batch query
    raw_role_ids = {u.get("role_id") for u in docs if u.get("role_id")}
    valid_role_ids = [ObjectId(rid) for rid in raw_role_ids if ObjectId.is_valid(rid)]
    role_docs = await db["roles"].find(
        {"_id": {"$in": valid_role_ids}}, {"_id": 1, "role_name": 1}
    ).to_list(100) if valid_role_ids else []
    role_map = {str(r["_id"]): r.get("role_name", "") for r in role_docs}

    users = [{
        "id":          str(u["_id"]),
        "name":        u.get("name", ""),
        "email":       u.get("email", ""),
        "designation": u.get("designation", ""),
        "avatar":      u.get("avatar", ""),
        "status":      u.get("status", "active"),
        "role_name":   role_map.get(u.get("role_id", ""), ""),
    } for u in docs]
    return success_response(data=users, message="Users retrieved")


@router.post("", status_code=201)
async def create_team(
    body: CreateTeamRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    if not _has_perm(current_user, "teams", "create"):
        return error_response("Insufficient permissions to create teams", status_code=403)
    uid = str(current_user["_id"])
    now = datetime.now(timezone.utc)

    # Validate the selected ids against real users
    requested = [i for i in (body.leader_ids + body.member_ids) if ObjectId.is_valid(i)]
    valid_ids: set[str] = set()
    if requested:
        found = await db["users"].find(
            {"_id": {"$in": [ObjectId(i) for i in requested]}}, {"_id": 1}
        ).to_list(500)
        valid_ids = {str(u["_id"]) for u in found}

    members: list[dict] = []
    seen: set[str] = set()
    for lid in body.leader_ids:
        if lid in valid_ids and lid not in seen:
            members.append({"user_id": lid, "role": "leader", "joined_at": now})
            seen.add(lid)
    for mid in body.member_ids:
        if mid in valid_ids and mid not in seen:
            members.append({"user_id": mid, "role": "member", "joined_at": now})
            seen.add(mid)

    # Guarantee at least one leader — fall back to the creator
    if not any(m["role"] == "leader" for m in members):
        if uid in seen:
            for m in members:
                if m["user_id"] == uid:
                    m["role"] = "leader"
        else:
            members.insert(0, {"user_id": uid, "role": "leader", "joined_at": now})

    doc = {
        "name":        body.name.strip(),
        "description": body.description or "",
        "color":       body.color or "#6366f1",
        "status":      body.status or "active",
        "created_by":  uid,
        "members":     members,
        "created_at":  now,
        "updated_at":  now,
    }
    result = await db["teams"].insert_one(doc)
    doc["_id"] = result.inserted_id
    return success_response(data=_serialize_team(doc), message="Team created", status_code=201)


@router.get("/{team_id}")
async def get_team(
    team_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    team, err = await _get_team_or_404(db, team_id)
    if err:
        return err

    uid = str(current_user["_id"])
    member_ids = [m["user_id"] for m in team.get("members", [])]
    if not _can_see_all_teams(current_user) and uid not in member_ids:
        return error_response("Not a member of this team", status_code=403)

    t = _serialize_team(team)
    t["members"] = await _enrich_members(db, team.get("members", []))

    # Caller's role in this team (drives frontend UI: member selector, scope note)
    # Only truly elevated roles (SA/Admin/Coordinator) get "admin"; Team Leader
    # gets "leader" (from the loop below) or "member" if they merely view the team.
    my_role = "admin" if _can_manage_any_team(current_user) else "member"
    for m in team.get("members", []):
        if m["user_id"] == uid:
            my_role = m["role"]
            break
    t["my_role"] = my_role

    # Task stats for the team
    task_count = await db["project_tasks"].count_documents({"team_id": team_id})
    done_count  = await db["project_tasks"].count_documents(
        {"team_id": team_id, "status": "currently_working"}
    )
    t["task_count"] = task_count
    t["done_count"]  = done_count

    return success_response(data=t, message="Team retrieved")


@router.put("/{team_id}")
async def update_team(
    team_id: str,
    body: UpdateTeamRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    team, err = await _get_team_or_404(db, team_id)
    if err:
        return err
    if not _can_manage(team, current_user):
        return error_response("Leader or admin access required", status_code=403)

    updates = body.model_dump(exclude_none=True)
    updates["updated_at"] = datetime.now(timezone.utc)
    try:
        oid = ObjectId(team_id)
    except InvalidId:
        return error_response("Invalid team ID", status_code=422)
    updated = await db["teams"].find_one_and_update(
        {"_id": oid}, {"$set": updates}, return_document=True
    )
    return success_response(data=_serialize_team(updated), message="Team updated")


@router.delete("/{team_id}", status_code=204)
async def delete_team(
    team_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    if not _has_perm(current_user, "teams", "delete"):
        return error_response("Insufficient permissions to delete teams", status_code=403)
    try:
        oid = ObjectId(team_id)
    except InvalidId:
        return error_response("Invalid team ID", status_code=422)
    result = await db["teams"].delete_one({"_id": oid})
    if result.deleted_count == 0:
        return error_response("Team not found", status_code=404)
    return None


@router.post("/{team_id}/members", status_code=201)
async def add_member(
    team_id: str,
    body: AddMemberRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    team, err = await _get_team_or_404(db, team_id)
    if err:
        return err
    if not _can_manage(team, current_user):
        return error_response("Leader or admin access required", status_code=403)
    if body.role not in VALID_ROLES:
        return error_response(f"Invalid role. Must be one of: {', '.join(VALID_ROLES)}", status_code=400)

    # Check user exists
    if not ObjectId.is_valid(body.user_id):
        return error_response("Invalid user ID", status_code=422)
    user = await db["users"].find_one({"_id": ObjectId(body.user_id)})
    if not user:
        return error_response("User not found", status_code=404)

    # ── Team Leader restrictions ───────────────────────────────────────────────
    if not _can_manage_any_team(current_user):
        # Team Leaders may not assign the team "leader" seat to a new member
        if body.role == "leader":
            return error_response(
                "Team Leaders cannot add new team leaders — contact an Admin or Coordinator.",
                status_code=403,
            )
        # Team Leaders may only add users whose system role is "Employee"
        target_role_id = user.get("role_id", "")
        target_role_name = ""
        if target_role_id and ObjectId.is_valid(target_role_id):
            target_role_doc = await db["roles"].find_one({"_id": ObjectId(target_role_id)})
            target_role_name = (target_role_doc or {}).get("role_name", "")
        if target_role_name != "Employee":
            return error_response(
                "Team Leaders can only add Employees to their team.",
                status_code=403,
            )

    # Check not already a member
    existing_ids = [m["user_id"] for m in team.get("members", [])]
    if body.user_id in existing_ids:
        return error_response("User is already a member of this team", status_code=409)

    now = datetime.now(timezone.utc)
    new_member = {"user_id": body.user_id, "role": body.role, "joined_at": now}
    try:
        oid = ObjectId(team_id)
    except InvalidId:
        return error_response("Invalid team ID", status_code=422)
    await db["teams"].update_one(
        {"_id": oid},
        {"$push": {"members": new_member}, "$set": {"updated_at": now}}
    )
    # Return a JSON-safe payload (datetime → isoformat) — a raw datetime here
    # causes a 500 during JSON serialization.
    return success_response(
        data={"user_id": body.user_id, "role": body.role, "joined_at": now.isoformat()},
        message="Member added",
        status_code=201,
    )


@router.delete("/{team_id}/members/{user_id}", status_code=204)
async def remove_member(
    team_id: str,
    user_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    team, err = await _get_team_or_404(db, team_id)
    if err:
        return err
    if not _can_manage(team, current_user):
        return error_response("Leader or admin access required", status_code=403)

    # Prevent removing the last leader
    leaders = [m for m in team.get("members", []) if m["role"] == "leader"]
    if len(leaders) == 1 and leaders[0]["user_id"] == user_id:
        return error_response("Cannot remove the only team leader. Promote another member first.", status_code=400)

    try:
        oid = ObjectId(team_id)
    except InvalidId:
        return error_response("Invalid team ID", status_code=422)
    await db["teams"].update_one(
        {"_id": oid},
        {"$pull": {"members": {"user_id": user_id}}, "$set": {"updated_at": datetime.now(timezone.utc)}}
    )
    return None


@router.put("/{team_id}/members/{user_id}/role")
async def update_member_role(
    team_id: str,
    user_id: str,
    body: UpdateMemberRoleRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    team, err = await _get_team_or_404(db, team_id)
    if err:
        return err
    if not _can_manage(team, current_user):
        return error_response("Leader or admin access required", status_code=403)
    # Team Leaders can demote existing leaders but cannot promote members to leader
    if not _can_manage_any_team(current_user) and body.role == "leader":
        return error_response(
            "Team Leaders cannot promote members to team leader — contact an Admin or Coordinator.",
            status_code=403,
        )
    if body.role not in VALID_ROLES:
        return error_response(f"Invalid role. Must be one of: {', '.join(VALID_ROLES)}", status_code=400)

    try:
        oid = ObjectId(team_id)
    except InvalidId:
        return error_response("Invalid team ID", status_code=422)
    result = await db["teams"].update_one(
        {"_id": oid, "members.user_id": user_id},
        {"$set": {"members.$.role": body.role, "updated_at": datetime.now(timezone.utc)}}
    )
    if result.matched_count == 0:
        return error_response("Member not found in this team", status_code=404)
    return success_response(data={"user_id": user_id, "role": body.role}, message="Role updated")


@router.get("/{team_id}/members/{user_id}/report")
async def member_report(
    team_id: str,
    user_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Full performance report for a team member."""
    team, err = await _get_team_or_404(db, team_id)
    if err:
        return err

    caller_id = str(current_user["_id"])
    is_admin   = _can_see_all_teams(current_user)
    is_leader  = _is_leader_of(team, caller_id)
    is_self    = caller_id == user_id

    if not (is_admin or is_leader or is_self):
        return error_response("Access denied — leaders and admins only", status_code=403)

    # Fetch user profile
    if not ObjectId.is_valid(user_id):
        return error_response("Invalid user ID", status_code=422)
    user = await db["users"].find_one({"_id": ObjectId(user_id)})
    if not user:
        return error_response("User not found", status_code=404)

    # Task stats for this member
    all_tasks    = await db["project_tasks"].find({"assigned_to": user_id}).to_list(1000)
    team_tasks   = [t for t in all_tasks if t.get("team_id") == team_id]
    by_status    = {}
    by_priority  = {}
    for t in team_tasks:
        s = t.get("status", "pending")
        p = t.get("priority", "medium")
        by_status[s]   = by_status.get(s, 0) + 1
        by_priority[p] = by_priority.get(p, 0) + 1

    completed  = by_status.get("currently_working", 0)
    total      = len(team_tasks)
    completion = round(completed / total * 100) if total > 0 else 0

    # Recent tasks (last 10)
    recent_tasks = sorted(team_tasks, key=lambda x: x.get("updated_at", x.get("created_at")), reverse=True)[:10]
    def _ser_task(t):
        return {
            "id":          str(t["_id"]),
            "title":       t.get("title", ""),
            "status":      t.get("status", "pending"),
            "priority":    t.get("priority", "medium"),
            "due_date":    t.get("due_date"),
            "updated_at":  t["updated_at"].isoformat() if hasattr(t.get("updated_at"), "isoformat") else None,
        }

    # Member since
    member_since = None
    for m in team.get("members", []):
        if m["user_id"] == user_id:
            member_since = m.get("joined_at")
            if hasattr(member_since, "isoformat"):
                member_since = member_since.isoformat()
            break

    report = {
        "user": {
            "id":          str(user["_id"]),
            "name":        user.get("name", ""),
            "email":       user.get("email", ""),
            "designation": user.get("designation", ""),
            "avatar":      user.get("avatar", ""),
            "status":      user.get("status", "active"),
        },
        "member_since": member_since,
        "team_name":    team.get("name", ""),
        "tasks": {
            "total":         total,
            "completed":     completed,
            "completion_pct": completion,
            "by_status":     by_status,
            "by_priority":   by_priority,
            "recent":        [_ser_task(t) for t in recent_tasks],
        },
    }
    return success_response(data=report, message="Member report retrieved")
