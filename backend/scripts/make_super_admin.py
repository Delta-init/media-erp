"""
Grant Super Admin access to a user (by email).

Sets the two things the app checks for full super-admin power:
  • user.role     = "admin"                  (backend _is_admin checks)
  • user.role_id  = <Super Admin role id>    (frontend permission bypass)
  • user.status   = "active"                 (so the account can log in)

The "Super Admin" system role is created automatically if it doesn't exist.

Usage (from the backend/ directory):
    python -m scripts.make_super_admin you@example.com
    # or fall back to the ADMIN_EMAIL env / default:
    python -m scripts.make_super_admin
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from datetime import datetime, timezone

from motor.motor_asyncio import AsyncIOMotorClient

from app.config import settings
from app.models.role import all_permissions


async def main(email: str) -> None:
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.mongodb_db_name]

    # 1. Ensure the Super Admin role exists
    role = await db["roles"].find_one({"role_name": "Super Admin"})
    if role:
        role_id = str(role["_id"])
        print(f"[OK]   Super Admin role exists (id={role_id})")
    else:
        now = datetime.now(timezone.utc)
        res = await db["roles"].insert_one({
            "role_name": "Super Admin",
            "description": "Full access to everything",
            "is_system_role": True,
            "permissions": all_permissions(),
            "created_at": now,
            "updated_at": now,
        })
        role_id = str(res.inserted_id)
        print(f"[OK]   Super Admin role created (id={role_id})")

    # 2. Find the user
    user = await db["users"].find_one({"email": email})
    if not user:
        print(f"\n[FAIL] No user found with email '{email}'.")
        existing = await db["users"].distinct("email")
        print("       Existing users:", existing)
        client.close()
        return

    # 3. Promote
    await db["users"].update_one(
        {"_id": user["_id"]},
        {"$set": {
            "role": "admin",
            "role_id": role_id,
            "status": "active",
            "is_active": True,
            "updated_at": datetime.now(timezone.utc),
        }},
    )
    print(f"\n[OK]   '{email}' is now a Super Admin.")
    print("       role='admin', role_id set, status='active'")
    print("       Log out and back in for it to take effect.")
    client.close()


if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else os.getenv("ADMIN_EMAIL", "admin@mediaerp.com")
    asyncio.run(main(target))
