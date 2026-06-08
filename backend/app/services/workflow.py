"""
Project task workflow state machine.

Fixed columns:  pending -> started -> (break) -> pending_review -> approved
                                         \-> reedit <-/  (leader sends back)

Rules:
  - pending        -> started
  - started        -> break | pending_review
  - break          -> started
  - reedit         -> started               (member picks the rework back up)
  - pending_review -> approved | reedit      (leader/admin only — approve or send to reedit)
  - approved       -> (terminal)

  - Only ONE task per assignee may be in "started"; moving a task into started
    bumps that assignee's other started task to "break".
  - Nothing returns to "pending" — that is only the entry point for new work.
    A leader rejecting a review sends it to "reedit", not "pending".
"""
from datetime import datetime, timezone

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    "pending":        {"started"},
    "started":        {"break", "pending_review"},
    "break":          {"started"},
    "reedit":         {"started"},
    "pending_review": {"approved", "reedit"},
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
        "reedit": "Reedit", "pending_review": "Pending Review", "approved": "Approved",
    }
    c = labels.get(current, current)
    t = labels.get(target, target)
    if target == "pending":
        return (f"Can't move {c} to Pending. Pending is only for brand-new work — "
                f"a leader rejecting a review sends it to Reedit instead.")
    if target == "approved" and current != "pending_review":
        return "Tasks can only be Approved from Pending Review (a leader approves them)."
    if target == "reedit" and current != "pending_review":
        return "A task only goes to Reedit when a team leader sends it back from Pending Review."
    return f"Invalid move: {c} -> {t}."


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
