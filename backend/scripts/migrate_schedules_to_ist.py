"""
Recompute `next_send_at` for existing email report schedules using IST.

Before the IST migration, `send_time` ("HH:MM") was interpreted as a **UTC**
wall-clock time, so a schedule set to "09:00" actually fired at 09:00 UTC =
14:30 IST. mediaERP now treats `send_time` as IST wall-clock. Rows created
before the fix still hold the old (wrong) instant, so recompute them once.

Usage (from the backend/ directory):
    python -m scripts.migrate_schedules_to_ist          # dry run
    python -m scripts.migrate_schedules_to_ist --apply  # write changes
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from motor.motor_asyncio import AsyncIOMotorClient

from app.config import settings
from app.routers.email_reports import _compute_next_send
from app.utils.timezone import to_ist


async def main(apply: bool) -> None:
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.mongodb_db_name]

    docs = await db["email_schedules"].find({}).to_list(1000)
    if not docs:
        print("No email schedules found.")
        client.close()
        return

    print(f"{'APPLYING' if apply else 'DRY RUN'} — {len(docs)} schedule(s)\n")
    changed = 0
    for d in docs:
        old = d.get("next_send_at")
        new = _compute_next_send(
            d.get("frequency", "weekly"),
            d.get("send_time", "09:00"),
            d.get("day_of_week"),
            d.get("day_of_month"),
        )
        old_ist = to_ist(old).strftime("%d %b %Y %H:%M") if old else "—"
        new_ist = to_ist(new).strftime("%d %b %Y %H:%M")
        same = old is not None and to_ist(old) == to_ist(new)
        print(f"  {d.get('name','(unnamed)')!r}  send_time={d.get('send_time')} ({d.get('frequency')})")
        print(f"      old next_send_at -> {old_ist} IST")
        print(f"      new next_send_at -> {new_ist} IST   {'(unchanged)' if same else '<-- FIXED'}")
        if not same:
            changed += 1
            if apply:
                await db["email_schedules"].update_one(
                    {"_id": d["_id"]}, {"$set": {"next_send_at": new}}
                )

    print(f"\n{changed} schedule(s) {'updated' if apply else 'would be updated'}.")
    if not apply and changed:
        print("Re-run with --apply to write the changes.")
    client.close()


if __name__ == "__main__":
    asyncio.run(main("--apply" in sys.argv))
