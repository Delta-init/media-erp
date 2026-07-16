"""
Group chat + daily-report scheduler.

One chat group is auto-provisioned per team (members = the team's members).
Groups are full two-way chats. In addition, a scheduler posts each team's
daily task report into its group every day at 21:00 IST (Asia/Kolkata).

Group messages live in the `messages` collection with a `group_id` field set
(and no `to_user_id`), so they never collide with 1:1 direct messages.
"""
import asyncio
import logging
from datetime import datetime, timedelta, timezone

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.database import get_db

logger = logging.getLogger(__name__)

from app.utils.timezone import IST  # single source of truth for IST (UTC+05:30)
from app.utils.timezone import utc_iso

_POLL_INTERVAL_SEC = 60
_REPORT_HOUR_IST = 21  # 9 PM IST

# Sentinel sender for automated report posts
SYSTEM_SENDER_ID = "system"
SYSTEM_SENDER_NAME = "📊 Daily Report"

_COMPLETED_STATUS = "approved"


# ── Serialization ─────────────────────────────────────────────────────────────

def group_message_to_dict(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "group_id": doc.get("group_id", ""),
        "from_user_id": doc.get("from_user_id", ""),
        "from_user_name": doc.get("from_user_name", ""),
        "content": doc.get("content", ""),
        "is_system": bool(doc.get("is_system", False)),
        "attachments": doc.get("attachments", []),
        "task_ids": doc.get("task_ids", []),
        "created_at": utc_iso(doc.get("created_at")),
    }


def _serialize_group(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "name": doc.get("name", ""),
        "team_id": doc.get("team_id", ""),
        "color": doc.get("color", "#6366f1"),
        "members": doc.get("members", []),
        "member_count": len(doc.get("members", [])),
        "is_report_group": bool(doc.get("is_report_group", True)),
    }


# ── Provisioning ──────────────────────────────────────────────────────────────

async def ensure_team_groups(db: AsyncIOMotorDatabase) -> None:
    """
    Upsert one report group per team, keeping membership in sync with the team.
    Idempotent — safe to call on every list/scheduler tick.
    """
    now = datetime.now(timezone.utc)
    teams = await db["teams"].find({}).to_list(1000)
    for team in teams:
        team_id = str(team["_id"])
        member_ids = [m["user_id"] for m in team.get("members", [])]
        existing = await db["chat_groups"].find_one({"team_id": team_id})
        if existing:
            # Keep name / colour / membership aligned with the team
            await db["chat_groups"].update_one(
                {"_id": existing["_id"]},
                {"$set": {
                    "name": team.get("name", "Team"),
                    "color": team.get("color", "#6366f1"),
                    "members": member_ids,
                    "updated_at": now,
                }},
            )
        else:
            await db["chat_groups"].insert_one({
                "name": team.get("name", "Team"),
                "team_id": team_id,
                "color": team.get("color", "#6366f1"),
                "members": member_ids,
                "is_report_group": True,
                "created_by": team.get("created_by", ""),
                "last_report_date": None,
                "created_at": now,
                "updated_at": now,
            })


_ELEVATED_ROLES = {"Super Admin", "Admin", "Coordinator"}


async def is_elevated(db: AsyncIOMotorDatabase, user_id: str) -> bool:
    """True for Super Admin / Admin / Coordinator — they may see & post in any group."""
    if not ObjectId.is_valid(user_id):
        return False
    user = await db["users"].find_one({"_id": ObjectId(user_id)}, {"role_id": 1})
    role_id = (user or {}).get("role_id", "")
    if not role_id or not ObjectId.is_valid(role_id):
        return False
    role = await db["roles"].find_one({"_id": ObjectId(role_id)}, {"role_name": 1})
    return (role or {}).get("role_name", "") in _ELEVATED_ROLES


async def can_access_group(db: AsyncIOMotorDatabase, group_id: str, user_id: str) -> bool:
    """A user can access a group if they are a member or an elevated role."""
    members = await group_member_ids(db, group_id)
    if user_id in members:
        return True
    return await is_elevated(db, user_id)


async def group_member_ids(db: AsyncIOMotorDatabase, group_id: str) -> list[str]:
    if not ObjectId.is_valid(group_id):
        return []
    doc = await db["chat_groups"].find_one({"_id": ObjectId(group_id)}, {"members": 1})
    return doc.get("members", []) if doc else []


async def get_group(db: AsyncIOMotorDatabase, group_id: str) -> dict | None:
    if not ObjectId.is_valid(group_id):
        return None
    return await db["chat_groups"].find_one({"_id": ObjectId(group_id)})


async def list_groups_for_user(
    db: AsyncIOMotorDatabase, user_id: str, include_all: bool = False
) -> list[dict]:
    """Groups the user belongs to (or all groups for elevated roles), with a preview."""
    await ensure_team_groups(db)
    query = {} if include_all else {"members": user_id}
    docs = await db["chat_groups"].find(query).sort("name", 1).to_list(500)
    out = []
    for d in docs:
        g = _serialize_group(d)
        last = await db["messages"].find_one(
            {"group_id": g["id"]}, sort=[("_id", -1)]
        )
        if last:
            g["last_message"] = last.get("content", "")
            g["last_sender_name"] = last.get("from_user_name", "")
            g["last_at"] = utc_iso(last.get("created_at"))
        else:
            g["last_message"] = ""
            g["last_sender_name"] = ""
            g["last_at"] = None
        out.append(g)
    return out


# ── Messages ──────────────────────────────────────────────────────────────────

async def save_group_message(
    db: AsyncIOMotorDatabase,
    group_id: str,
    from_user_id: str,
    from_user_name: str,
    content: str,
    is_system: bool = False,
    attachments: list | None = None,
    task_ids: list | None = None,
) -> dict:
    doc = {
        "group_id": group_id,
        "from_user_id": from_user_id,
        "from_user_name": from_user_name,
        "content": content,
        "is_system": is_system,
        "attachments": attachments or [],
        "task_ids": task_ids or [],
        "created_at": datetime.now(timezone.utc),
    }
    result = await db["messages"].insert_one(doc)
    doc["_id"] = result.inserted_id
    return doc


async def get_group_messages(
    db: AsyncIOMotorDatabase,
    group_id: str,
    limit: int = 50,
    before_id: str | None = None,
) -> list[dict]:
    query: dict = {"group_id": group_id}
    if before_id and ObjectId.is_valid(before_id):
        query["_id"] = {"$lt": ObjectId(before_id)}
    cursor = db["messages"].find(query).sort("_id", -1).limit(limit)
    docs = await cursor.to_list(limit)
    return list(reversed(docs))


# ── Daily report text ─────────────────────────────────────────────────────────

def _as_utc(value) -> datetime | None:
    if not isinstance(value, datetime):
        return None
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


async def build_daily_report_text(db: AsyncIOMotorDatabase, team: dict) -> str:
    """Format today's (IST) task activity for a team as a chat message."""
    team_id = str(team["_id"])
    ist_now = datetime.now(IST)
    start_utc = ist_now.replace(hour=0, minute=0, second=0, microsecond=0).astimezone(timezone.utc)
    end_utc = ist_now.astimezone(timezone.utc)

    tasks = await db["project_tasks"].find({"team_id": team_id}).to_list(5000)

    created = 0
    completed = 0
    active = 0
    per_member: dict[str, dict] = {}
    for t in tasks:
        status = t.get("status", "pending")
        if status == "started":
            active += 1
        assignee = t.get("assigned_to", "")
        c_at = _as_utc(t.get("created_at"))
        u_at = _as_utc(t.get("updated_at"))
        if c_at and start_utc <= c_at <= end_utc:
            created += 1
            per_member.setdefault(assignee, {"created": 0, "completed": 0})["created"] += 1
        if status == _COMPLETED_STATUS and u_at and start_utc <= u_at <= end_utc:
            completed += 1
            per_member.setdefault(assignee, {"created": 0, "completed": 0})["completed"] += 1

    # Resolve member names
    name_map: dict[str, str] = {}
    ids = [ObjectId(m["user_id"]) for m in team.get("members", []) if ObjectId.is_valid(m["user_id"])]
    if ids:
        for u in await db["users"].find({"_id": {"$in": ids}}, {"name": 1}).to_list(500):
            name_map[str(u["_id"])] = u.get("name", "Unknown")

    date_label = ist_now.strftime("%d %b %Y")
    lines = [
        f"📊 Daily Report — {team.get('name', 'Team')} · {date_label}",
        f"Created: {created} · Completed: {completed} · In progress: {active}",
    ]

    member_lines = []
    for m in team.get("members", []):
        uid = m["user_id"]
        stats = per_member.get(uid)
        if not stats:
            continue
        member_lines.append(
            f"• {name_map.get(uid, 'Unknown')}: {stats['created']} created, {stats['completed']} completed"
        )
    if member_lines:
        lines.append("——")
        lines.extend(member_lines)
    elif created == 0 and completed == 0:
        lines.append("No task activity logged today.")

    return "\n".join(lines)


_OPEN_STATUS_LABELS = {
    "pending": "pending",
    "started": "in progress",
    "break": "on break",
    "reedit": "reedit",
    "pending_review": "in review",
}


async def post_member_reports(db: AsyncIOMotorDatabase, group: dict, team: dict) -> None:
    """
    Post one message per member into the group: their named tasks done today
    (IST) and everything still pending. Members with no tasks are skipped.
    """
    team_id = str(team["_id"])
    ist_now = datetime.now(IST)
    start_utc = ist_now.replace(hour=0, minute=0, second=0, microsecond=0).astimezone(timezone.utc)
    end_utc = ist_now.astimezone(timezone.utc)
    date_label = ist_now.strftime("%d %b %Y")

    # Resolve member names
    name_map: dict[str, str] = {}
    ids = [ObjectId(m["user_id"]) for m in team.get("members", []) if ObjectId.is_valid(m["user_id"])]
    if ids:
        for u in await db["users"].find({"_id": {"$in": ids}}, {"name": 1}).to_list(500):
            name_map[str(u["_id"])] = u.get("name", "Unknown")

    tasks = await db["project_tasks"].find({"team_id": team_id}).to_list(5000)

    for m in team.get("members", []):
        uid = m["user_id"]
        done_today: list[dict] = []
        pending: list[dict] = []
        for t in tasks:
            if t.get("assigned_to") != uid:
                continue
            status = t.get("status", "pending")
            u_at = _as_utc(t.get("updated_at"))
            if status == _COMPLETED_STATUS:
                if u_at and start_utc <= u_at <= end_utc:
                    done_today.append(t)
            else:
                pending.append(t)

        if not done_today and not pending:
            continue  # nothing to report for this member

        lines = [f"🧑 {name_map.get(uid, 'Member')} — Daily Report · {date_label}"]
        lines.append(f"✅ Done today: {len(done_today)}")
        for t in done_today[:15]:
            lines.append(f"   • {t.get('title', 'Task')}")
        lines.append(f"⏳ Pending: {len(pending)}")
        for t in pending[:15]:
            label = _OPEN_STATUS_LABELS.get(t.get("status", "pending"), t.get("status", "pending"))
            lines.append(f"   • {t.get('title', 'Task')} ({label})")

        task_ids = [str(t["_id"]) for t in (done_today + pending)]
        await save_group_message(
            db,
            group_id=str(group["_id"]),
            from_user_id=uid,
            from_user_name=name_map.get(uid, "Member"),
            content="\n".join(lines),
            is_system=True,
            task_ids=task_ids,
        )


async def post_daily_report(db: AsyncIOMotorDatabase, group: dict, team: dict) -> None:
    """Post the team summary followed by each member's named done/pending report."""
    text = await build_daily_report_text(db, team)
    await save_group_message(
        db,
        group_id=str(group["_id"]),
        from_user_id=SYSTEM_SENDER_ID,
        from_user_name=SYSTEM_SENDER_NAME,
        content=text,
        is_system=True,
    )
    await post_member_reports(db, group, team)


# ── Scheduler ─────────────────────────────────────────────────────────────────

async def _scheduler_loop(db: AsyncIOMotorDatabase):
    """Every minute: at/after 21:00 IST, post each team group's daily report once per day."""
    while True:
        try:
            await ensure_team_groups(db)
            ist_now = datetime.now(IST)
            today_key = ist_now.strftime("%Y-%m-%d")
            if ist_now.hour >= _REPORT_HOUR_IST:
                groups = await db["chat_groups"].find({"is_report_group": True}).to_list(1000)
                for group in groups:
                    if group.get("last_report_date") == today_key:
                        continue
                    team = await db["teams"].find_one({"_id": ObjectId(group["team_id"])}) \
                        if ObjectId.is_valid(group.get("team_id", "")) else None
                    if not team:
                        continue
                    try:
                        await post_daily_report(db, group, team)
                        await db["chat_groups"].update_one(
                            {"_id": group["_id"]},
                            {"$set": {"last_report_date": today_key, "updated_at": datetime.now(timezone.utc)}},
                        )
                        logger.info("Posted daily report to group '%s'", group.get("name"))
                    except Exception as exc:
                        logger.error("Failed to post daily report for group %s: %s", group["_id"], exc)
        except Exception as exc:
            logger.error("Group report scheduler loop error: %s", exc)
        await asyncio.sleep(_POLL_INTERVAL_SEC)


def start_group_report_scheduler():
    """Entry-point called from main.py lifespan — runs in a daemon thread."""
    async def _run():
        from motor.motor_asyncio import AsyncIOMotorClient
        from app.config import settings
        client = AsyncIOMotorClient(settings.mongodb_url)
        db = client[settings.mongodb_db_name]
        await _scheduler_loop(db)

    try:
        loop = asyncio.new_event_loop()
        loop.run_until_complete(_run())
    except Exception as exc:
        logger.error("Group report scheduler thread crashed: %s", exc)
