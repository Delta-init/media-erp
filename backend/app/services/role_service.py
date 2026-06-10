import math
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from bson.errors import InvalidId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.role import MODULES, ACTIONS, default_permissions, all_permissions
from app.schemas.role import CreateRoleRequest, UpdateRoleRequest


def _serialize_role(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "role_name": doc["role_name"],
        "description": doc.get("description", ""),
        "is_system_role": doc.get("is_system_role", False),
        "permissions": doc.get("permissions", default_permissions()),
        "created_at": doc.get("created_at", "").isoformat() if isinstance(doc.get("created_at"), datetime) else doc.get("created_at", ""),
        "updated_at": doc.get("updated_at", "").isoformat() if isinstance(doc.get("updated_at"), datetime) else doc.get("updated_at", ""),
    }


async def list_roles(
    db: AsyncIOMotorDatabase,
    search: str = "",
    page: int = 1,
    limit: int = 20,
) -> dict:
    query: dict = {}
    if search:
        query["role_name"] = {"$regex": search, "$options": "i"}

    total = await db["roles"].count_documents(query)
    skip = (page - 1) * limit
    cursor = db["roles"].find(query).sort("created_at", -1).skip(skip).limit(limit)
    docs = await cursor.to_list(length=limit)

    return {
        "roles": [_serialize_role(d) for d in docs],
        "total": total,
        "page": page,
        "pages": math.ceil(total / limit) if limit else 1,
    }


async def list_roles_simple(db: AsyncIOMotorDatabase) -> list[dict]:
    """Return id + role_name only — used for dropdowns."""
    cursor = db["roles"].find({}, {"role_name": 1}).sort("role_name", 1)
    docs = await cursor.to_list(length=200)
    return [{"id": str(d["_id"]), "role_name": d["role_name"]} for d in docs]


async def get_role(db: AsyncIOMotorDatabase, role_id: str) -> dict:
    try:
        oid = ObjectId(role_id)
    except InvalidId:
        raise ValueError("Invalid role ID")
    doc = await db["roles"].find_one({"_id": oid})
    if not doc:
        raise ValueError("Role not found")
    return _serialize_role(doc)


async def create_role(db: AsyncIOMotorDatabase, data: CreateRoleRequest) -> dict:
    existing = await db["roles"].find_one({"role_name": {"$regex": f"^{data.role_name}$", "$options": "i"}})
    if existing:
        raise ValueError(f"Role '{data.role_name}' already exists")

    # Build permissions dict — fill missing modules with defaults
    base = default_permissions()
    if data.permissions:
        for module, perms in data.permissions.items():
            if module in MODULES:
                base[module] = {a: getattr(perms, a, False) for a in ACTIONS}

    now = datetime.now(timezone.utc)
    doc = {
        "role_name": data.role_name,
        "description": data.description or "",
        "is_system_role": False,
        "permissions": base,
        "created_at": now,
        "updated_at": now,
    }
    result = await db["roles"].insert_one(doc)
    doc["_id"] = result.inserted_id
    return _serialize_role(doc)


async def update_role(db: AsyncIOMotorDatabase, role_id: str, data: UpdateRoleRequest) -> dict:
    try:
        oid = ObjectId(role_id)
    except InvalidId:
        raise ValueError("Invalid role ID")

    doc = await db["roles"].find_one({"_id": oid})
    if not doc:
        raise ValueError("Role not found")

    if doc.get("is_system_role") and data.role_name and data.role_name != doc["role_name"]:
        raise ValueError("Cannot rename a system role.")

    # Super Admin role is fully immutable — no permission edits either
    if doc["role_name"] == "Super Admin" and data.permissions is not None:
        raise ValueError("Super Admin permissions cannot be modified.")

    patch: dict = {"updated_at": datetime.now(timezone.utc)}

    if data.role_name is not None:
        # Check uniqueness
        clash = await db["roles"].find_one({
            "role_name": {"$regex": f"^{data.role_name}$", "$options": "i"},
            "_id": {"$ne": oid},
        })
        if clash:
            raise ValueError(f"Role '{data.role_name}' already exists")
        patch["role_name"] = data.role_name

    if data.description is not None:
        patch["description"] = data.description

    if data.permissions is not None:
        existing_perms = doc.get("permissions", default_permissions())
        for module, perms in data.permissions.items():
            if module in MODULES:
                existing_perms[module] = {a: getattr(perms, a, False) for a in ACTIONS}
        patch["permissions"] = existing_perms

    await db["roles"].update_one({"_id": oid}, {"$set": patch})
    updated = await db["roles"].find_one({"_id": oid})
    return _serialize_role(updated)


async def delete_role(db: AsyncIOMotorDatabase, role_id: str) -> None:
    try:
        oid = ObjectId(role_id)
    except InvalidId:
        raise ValueError("Invalid role ID")

    doc = await db["roles"].find_one({"_id": oid})
    if not doc:
        raise ValueError("Role not found")

    if doc.get("is_system_role"):
        raise ValueError("Cannot delete a system role")

    # Block if any users are assigned this role
    count = await db["users"].count_documents({"role_id": role_id})
    if count > 0:
        raise ValueError(f"Cannot delete: {count} user(s) are assigned this role")

    await db["roles"].delete_one({"_id": oid})
