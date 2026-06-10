"""
Migration: grant Coordinator teams.create + teams.delete permissions.

Run once from the backend directory:
    python scripts/migrate_coordinator_teams.py
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings
from app.models.role import coordinator_permissions


async def migrate():
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.mongodb_db_name]

    new_perms = coordinator_permissions()
    result = await db["roles"].update_one(
        {"role_name": "Coordinator"},
        {"$set": {"permissions": new_perms}},
    )

    if result.matched_count == 0:
        print("[ERR]  Coordinator role not found in DB — run seed_admin.py first.")
    elif result.modified_count == 0:
        print("[OK]  Coordinator already up to date (no change needed).")
    else:
        print("[OK]  Coordinator permissions updated — teams.create + teams.delete granted.")

    client.close()


if __name__ == "__main__":
    asyncio.run(migrate())
