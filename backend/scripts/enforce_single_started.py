"""
Enforce the "one Started task per person" rule on existing data.

If an assignee has more than one task in "started" (e.g. created by an earlier
bulk migration), keep the most recently updated one and move the rest to
"break". Tasks with no assignee are grouped per team.

Usage (from backend/ directory):
    python -m scripts.enforce_single_started --dry   # preview
    python -m scripts.enforce_single_started         # apply
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from datetime import datetime, timezone
from collections import defaultdict
from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings


async def main(dry: bool) -> None:
    db = AsyncIOMotorClient(settings.mongodb_url)[settings.mongodb_db_name]
    started = await db["project_tasks"].find({"status": "started"}).to_list(5000)

    # Group started tasks by owner key (assignee, else team, else "global")
    groups: dict[str, list[dict]] = defaultdict(list)
    for t in started:
        owner = (t.get("assigned_to") or "").strip() or f"team:{t.get('team_id') or 'none'}"
        groups[owner].append(t)

    moved = 0
    for owner, tasks in groups.items():
        if len(tasks) <= 1:
            continue
        # Keep the most recently updated; bump the rest to break
        tasks.sort(key=lambda x: x.get("updated_at") or x.get("created_at") or datetime.min, reverse=True)
        keep = tasks[0]
        print(f"owner {owner}: keep '{str(keep.get('title',''))[:24]}' in Started; "
              f"move {len(tasks)-1} other(s) to Break")
        for t in tasks[1:]:
            print(f"    -> Break: {str(t.get('title',''))[:30]}")
            if not dry:
                await db["project_tasks"].update_one(
                    {"_id": t["_id"]},
                    {"$set": {"status": "break", "updated_at": datetime.now(timezone.utc)}},
                )
            moved += 1

    print(f"\n{'Would move' if dry else 'Moved'} {moved} task(s) to Break.")
    if dry:
        print("Dry run — no changes written.")


if __name__ == "__main__":
    asyncio.run(main("--dry" in sys.argv))
