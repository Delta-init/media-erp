"""
Migrate task.status values onto the 5 FIXED Kanban columns:
    pending | started | break | pending_review | approved

Tasks may currently use legacy/custom status keys (e.g. "upcoming",
"currently_working", or renamed-column keys). This remaps each task to the
correct fixed key based on its current column's LABEL (read from
board_statuses), falling back to keyword matching on the raw status.

Usage (from backend/ directory):
    python -m scripts.migrate_task_statuses --dry   # preview
    python -m scripts.migrate_task_statuses         # apply
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings

FIXED = {"pending", "started", "break", "pending_review", "approved"}

# Keyword -> fixed key, most specific first.
RULES = [
    ("approv",   "approved"),
    ("complete", "approved"),
    ("done",     "approved"),
    ("review",   "pending_review"),
    ("break",    "break"),
    ("start",    "started"),
    ("progress", "started"),
    ("working",  "started"),
    ("upcoming", "started"),
    ("updation", "pending"),
    ("todo",     "pending"),
    ("pending",  "pending"),
]


def map_text(text: str) -> str:
    low = (text or "").lower()
    for kw, key in RULES:
        if kw in low:
            return key
    return "pending"


async def main(dry: bool) -> None:
    db = AsyncIOMotorClient(settings.mongodb_url)[settings.mongodb_db_name]

    # key -> label from the (legacy) board_statuses, to interpret current statuses
    cols = await db["board_statuses"].find({}).to_list(200)
    key_to_label = {c.get("key"): c.get("label", "") for c in cols}

    tasks = await db["project_tasks"].find({}).to_list(5000)
    changes = 0
    for t in tasks:
        cur = t.get("status", "")
        if cur in FIXED:
            continue
        # Prefer the column label this task currently sits under
        label = key_to_label.get(cur, cur)
        new = map_text(label)
        print(f"  {str(t.get('title',''))[:28]:28s}  {cur or '(none)'} -> {new}")
        if not dry:
            await db["project_tasks"].update_one(
                {"_id": t["_id"]},
                {"$set": {"status": new, "updated_at": datetime.now(timezone.utc)}},
            )
        changes += 1

    print(f"\n{'Would change' if dry else 'Changed'} {changes} task(s).")
    if dry:
        print("Dry run — no changes written.")


if __name__ == "__main__":
    asyncio.run(main("--dry" in sys.argv))
