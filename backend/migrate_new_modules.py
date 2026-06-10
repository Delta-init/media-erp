"""
Migration: add new permission modules (schedule, rules, email_reports,
social, chat, clients) to all 5 existing system roles in MongoDB.

Run once from the backend folder:
    python migrate_new_modules.py
"""

import asyncio
import sys
import motor.motor_asyncio

# ── adjust these if your config differs ────────────────────────────────────
MONGO_URL = "mongodb://localhost:27017"
DB_NAME   = "mediaerp"
# ───────────────────────────────────────────────────────────────────────────

# Import updated helpers from the app
sys.path.insert(0, ".")
from app.models.role import (
    admin_permissions,
    coordinator_permissions,
    team_leader_permissions,
    employee_permissions,
    all_permissions,
)

ROLE_PERMS = {
    "Super Admin":  all_permissions(),
    "Admin":        admin_permissions(),
    "Coordinator":  coordinator_permissions(),
    "Team Leader":  team_leader_permissions(),
    "Employee":     employee_permissions(),
}

NEW_MODULES = ["schedule", "rules", "email_reports", "social", "chat", "clients"]


async def main():
    client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    roles_col = db["roles"]

    updated = 0
    for role_name, full_perms in ROLE_PERMS.items():
        # Extract only the new module slices from the full perm dict
        patch = {f"permissions.{m}": full_perms[m] for m in NEW_MODULES}

        result = await roles_col.update_one(
            {"role_name": role_name},
            {"$set": patch},
        )
        if result.matched_count:
            print(f"[OK] {role_name}: updated {len(NEW_MODULES)} new modules")
            updated += 1
        else:
            print(f"[WARN] {role_name}: not found in DB (skipped)")

    client.close()
    print(f"\nDone — {updated}/{len(ROLE_PERMS)} roles updated.")


if __name__ == "__main__":
    asyncio.run(main())
