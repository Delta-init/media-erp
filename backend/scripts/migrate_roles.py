"""
Migrate existing database to the new 5-role system.

  - Inserts Admin, Coordinator, Team Leader, Employee if they don't exist.
  - Super Admin is left as-is (already present from seed_admin).
  - Legacy Manager / Viewer roles are NOT deleted automatically
    (reassign any users first, then delete from the Roles page).

Usage (from backend/ directory):
    python -m scripts.migrate_roles
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from datetime import datetime, timezone

from motor.motor_asyncio import AsyncIOMotorClient

from app.config import settings
from app.models.role import (
    admin_permissions,
    coordinator_permissions,
    team_leader_permissions,
    employee_permissions,
)

NEW_ROLES = [
    {
        "role_name": "Admin",
        "description": "Full operational access; cannot manage roles.",
        "is_system_role": True,
        "permissions": admin_permissions(),
    },
    {
        "role_name": "Coordinator",
        "description": "Manages campaigns, reports, and projects. Read-only on users.",
        "is_system_role": True,
        "permissions": coordinator_permissions(),
    },
    {
        "role_name": "Team Leader",
        "description": "Full project & task management within their teams.",
        "is_system_role": True,
        "permissions": team_leader_permissions(),
    },
    {
        "role_name": "Employee",
        "description": "Works on assigned tasks; view access to most modules.",
        "is_system_role": True,
        "permissions": employee_permissions(),
    },
]


async def migrate():
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.mongodb_db_name]

    print("=== mediaERP Role Migration ===\n")

    for role_data in NEW_ROLES:
        existing = await db["roles"].find_one({"role_name": role_data["role_name"]})
        if existing:
            print(f"[SKIP] Role '{role_data['role_name']}' already exists.")
        else:
            now = datetime.now(timezone.utc)
            result = await db["roles"].insert_one({**role_data, "created_at": now, "updated_at": now})
            print(f"[OK]   Role '{role_data['role_name']}' created (id={result.inserted_id})")

    # Ensure Super Admin role stays fully locked (all permissions true)
    sa = await db["roles"].find_one({"role_name": "Super Admin"})
    if sa:
        from app.models.role import all_permissions
        await db["roles"].update_one(
            {"role_name": "Super Admin"},
            {"$set": {"is_system_role": True, "permissions": all_permissions(), "updated_at": datetime.now(timezone.utc)}},
        )
        print("[OK]   Super Admin permissions refreshed.")

    print("\n=== Migration complete ===")
    print("\nNote: Legacy roles (Manager, Viewer) still exist if present.")
    print("      Reassign their users to the new roles, then delete them from the Roles page.")
    client.close()


if __name__ == "__main__":
    asyncio.run(migrate())
