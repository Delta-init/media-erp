"""
Assign clean, semantic colours to Kanban board columns based on their names.

Matches each column label against a keyword map (e.g. "approved" -> green,
"break" -> orange) and updates board_statuses.color. Columns that don't match
any keyword are left unchanged.

Usage (from backend/ directory):
    python -m scripts.recolor_columns          # apply
    python -m scripts.recolor_columns --dry    # preview only
"""
import asyncio
import sys

sys.path.insert(0, __import__("os").path.dirname(__import__("os").path.dirname(__file__)))

from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings

# Ordered most-specific first so "pending review" beats "pending".
KEYWORD_COLORS = [
    ("approv",        "#22c55e"),  # green
    ("complete",      "#22c55e"),
    ("done",          "#22c55e"),
    ("review",        "#a855f7"),  # purple
    ("break",         "#f97316"),  # orange
    ("block",         "#ef4444"),  # red
    ("reject",        "#ef4444"),
    ("updation",      "#ef4444"),
    ("start",         "#3b82f6"),  # blue
    ("progress",      "#3b82f6"),
    ("working",       "#3b82f6"),
    ("upcoming",      "#06b6d4"),  # cyan
    ("pending",       "#f59e0b"),  # amber
    ("todo",          "#64748b"),  # slate
    ("backlog",       "#64748b"),
]


def pick_color(label: str) -> str | None:
    low = label.lower()
    for kw, color in KEYWORD_COLORS:
        if kw in low:
            return color
    return None


async def main(dry: bool) -> None:
    db = AsyncIOMotorClient(settings.mongodb_url)[settings.mongodb_db_name]
    cols = await db["board_statuses"].find({}).sort("position", 1).to_list(200)
    if not cols:
        print("No board columns found.")
        return
    for c in cols:
        label = c.get("label", "")
        new = pick_color(label)
        cur = c.get("color", "")
        if new and new.lower() != cur.lower():
            print(f"  {label:20s} {cur or '(none)'} -> {new}")
            if not dry:
                await db["board_statuses"].update_one(
                    {"_id": c["_id"]},
                    {"$set": {"color": new, "updated_at": datetime.now(timezone.utc)}},
                )
        else:
            print(f"  {label:20s} {cur} (unchanged)")
    print("\nDone." if not dry else "\nDry run — no changes written.")


if __name__ == "__main__":
    asyncio.run(main("--dry" in sys.argv))
