"""
Seed the database with default roles and admin user.

Usage (from backend/ directory):
    python -m scripts.seed_admin

Env vars (optional — override with .env or export):
    ADMIN_EMAIL     (default: admin@mediaerp.com)
    ADMIN_PASSWORD  (default: Admin@123)
    ADMIN_NAME      (default: Super Admin)
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from datetime import datetime, timezone

from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext

from app.config import settings
from app.models.role import all_permissions, viewer_permissions, manager_permissions

_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@mediaerp.com")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "Admin@123")
ADMIN_NAME = os.getenv("ADMIN_NAME", "Super Admin")


SEED_ROLES = [
    {
        "role_name": "Super Admin",
        "description": "Full access to everything",
        "is_system_role": True,
        "permissions": all_permissions(),
    },
    {
        "role_name": "Manager",
        "description": "Can manage connectors, projects, and view reports",
        "is_system_role": False,
        "permissions": manager_permissions(),
    },
    {
        "role_name": "Viewer",
        "description": "Read-only access to reports and main modules",
        "is_system_role": False,
        "permissions": viewer_permissions(),
    },
]


async def seed():
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.mongodb_db_name]

    print("=== mediaERP Seed Script ===\n")

    # ── Seed roles ────────────────────────────────────────────────────────────
    role_ids: dict[str, str] = {}
    for role_data in SEED_ROLES:
        existing = await db["roles"].find_one({"role_name": role_data["role_name"]})
        if existing:
            role_ids[role_data["role_name"]] = str(existing["_id"])
            print(f"[SKIP] Role '{role_data['role_name']}' already exists.")
        else:
            now = datetime.now(timezone.utc)
            result = await db["roles"].insert_one({**role_data, "created_at": now, "updated_at": now})
            role_ids[role_data["role_name"]] = str(result.inserted_id)
            print(f"[OK]   Role '{role_data['role_name']}' created (id={result.inserted_id})")

    # ── Seed admin user ───────────────────────────────────────────────────────
    super_admin_role_id = role_ids.get("Super Admin", "")
    existing_admin = await db["users"].find_one({"email": ADMIN_EMAIL})
    if existing_admin:
        print(f"\n[SKIP] Admin user '{ADMIN_EMAIL}' already exists.")
        # Ensure the user has the Super Admin role assigned
        if not existing_admin.get("role_id"):
            await db["users"].update_one(
                {"email": ADMIN_EMAIL},
                {"$set": {"role_id": super_admin_role_id, "status": "active", "designation": "Administrator"}},
            )
            print(f"[OK]   Updated existing user with Super Admin role.")
    else:
        now = datetime.now(timezone.utc)
        admin_doc = {
            "name": ADMIN_NAME,
            "email": ADMIN_EMAIL,
            "hashed_password": _pwd.hash(ADMIN_PASSWORD),
            "role": "admin",
            "plan": "enterprise",
            "is_active": True,
            "role_id": super_admin_role_id,
            "designation": "Administrator",
            "status": "active",
            "created_at": now,
            "updated_at": now,
        }
        result = await db["users"].insert_one(admin_doc)
        print(f"\n[OK]   Admin user created:")
        print(f"       Email:    {ADMIN_EMAIL}")
        print(f"       Password: {ADMIN_PASSWORD}")
        print(f"       Role:     Super Admin")
        print(f"       ID:       {result.inserted_id}")

    # ── Ensure role_name index ────────────────────────────────────────────────
    await db["roles"].create_index("role_name", unique=True)
    await db["users"].create_index("email", unique=True)
    await db["users"].create_index("role_id")

    print("\n=== Seeding complete ===")
    client.close()


if __name__ == "__main__":
    asyncio.run(seed())
