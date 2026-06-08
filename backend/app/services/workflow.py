"""
Project task workflow state machine.

Fixed columns:  pending -> started -> (break) -> pending_review -> approved

Rules:
  - pending        -> started
  - started        -> break | pending_review
  - break          -> started
  - pending_review -> approved | pending   (leader/admin only — approve or rework)
  - approved       -> (terminal)

  - Only ONE task per assignee may be in "started"; moving a task into started
    bumps that assignee's other started task to "break".
  - You cannot move directly from started/break back to pending — the only path
    back to pending is a leader sending a pending_review task to rework.
"""
from datetime import datetime, timezone

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    "pending":        {"started"},
    "started":        {"break", "pending_review"},
    "break":          {"started"},
    "pending_review": {"approved", "pending"},
    "approved":       set(),
}

# Transitions out of pending_review (approve / send-to-rework) are leader-only.
LEADER_ONLY_FROM = {"pending_review"}


def is_allowed(current: str, target: str) -> bool:
    if current == target:
        return True
    return target in ALLOWED_TRANSITIONS.get(current, set())


def transition_error(current: str, target: str) -> str:
    labels = {
        "pending": "Pending", "started": "Started", "break": "Break",
        "pending_review": "Pending Review", "approved": "Approved",
    }
    c = labels.get(current, current)
    t = labels.get(target, target)
    if target == "pending" and current in ("started", "break"):
        return (f"Can't move {c} → Pending directly. A task only returns to "
                f"Pending when a team leader sends it to rework from Pending Review.")
    if target == "approved" and current != "pending_review":
        return f"Tasks can only be Approved from Pending Review (a leader approves them)."
    return f"Invalid move: {c} → {t}."


async def can_approve(current_user: dict, task: dict, db: AsyncIOMotorDatabase) -> bool:
    """True if the user may approve / rework a pending_review task."""
    if current_user.get("role") == "admin":
        return True
    team_id = task.get("team_id")
    if not team_id:
        return True  # personal (non-team) task — no leader gate
    try:
        team = await db["teams"].find_one({"_id": ObjectId(team_id)})
    except Exception:
        team = None
    if not team:
        return False
    uid = str(current_user["_id"])
    return any(
        m.get("user_id") == uid and m.get("role") == "leader"
        for m in team.get("members", [])
    )


async def bump_other_started(db: AsyncIOMotorDatabase, task: dict) -> None:
    """
    Enforce "one started task per person": move the assignee's OTHER started
    task(s) to break. Scope by assignee when set, else by team.
    """
    q: dict = {"status": "started", "_id": {"$ne": task["_id"]}}
    assignee = (task.get("assigned_to") or "").strip()
    if assignee:
        q["assigned_to"] = assignee
    elif task.get("team_id"):
        q["team_id"] = task["team_id"]
    else:
        return  # no scope to enforce against
    await db["project_tasks"].update_many(
        q, {"$set": {"status": "break", "updated_at": datetime.now(timezone.utc)}}
    )
