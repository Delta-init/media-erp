import math
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from bson.errors import InvalidId
from motor.motor_asyncio import AsyncIOMotorDatabase
from passlib.context import CryptContext

from app.schemas.user_admin import CreateUserRequest, UpdateUserRequest
from app.utils.timezone import utc_iso

_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Roles that only a Super Admin may assign
_ELEVATED_ROLES = {"Super Admin", "Admin"}


async def _check_role_assignment(db: AsyncIOMotorDatabase, caller: dict, target_role_id: str) -> dict:
    """
    Validate that `caller` is allowed to assign `target_role_id`.
    Returns the resolved role document so callers don't have to fetch it again.

    Rules
    -----
    - Super Admin  → can assign any role
    - Admin        → can assign Coordinator, Team Leader, Employee only
    - Others       → blocked by the users.create/edit permission check upstream;
                     still guarded here as a safety net
    """
    try:
        role_oid = ObjectId(target_role_id)
    except InvalidId:
        raise ValueError("Invalid role ID")

    role_doc = await db["roles"].find_one({"_id": role_oid})
    if not role_doc:
        raise ValueError("Role not found")

    target_name = role_doc.get("role_name", "")

    caller_role = caller.get("_role") or {}
    caller_name = caller_role.get("role_name", "")

    # Super Admin can do anything
    if caller_name == "Super Admin":
        return role_doc

    # Admin cannot assign Super Admin or Admin
    if target_name in _ELEVATED_ROLES:
        raise ValueError(
            f"Admin cannot assign the '{target_name}' role — only Super Admin can."
        )

    return role_doc


def _serialize_user(doc: dict, role_doc: Optional[dict] = None) -> dict:
    from app.services.role_service import _serialize_role

    role_data = None
    if role_doc:
        role_data = _serialize_role(role_doc)
    elif doc.get("_role"):
        role_data = _serialize_role(doc["_role"])

    return {
        "id": str(doc["_id"]),
        "name": doc.get("name", ""),
        "email": doc.get("email", ""),
        "role": role_data,
        "role_id": doc.get("role_id", ""),
        "designation": doc.get("designation", ""),
        "status": doc.get("status", "active"),
        "plan": doc.get("plan", "free"),
        "whatsapp_phone": doc.get("whatsapp_phone", ""),
        "created_at": utc_iso(doc.get("created_at", "")),
        "updated_at": utc_iso(doc.get("updated_at", "")),
    }


async def _with_role(db: AsyncIOMotorDatabase, user_doc: dict) -> dict:
    """Attach the role document to the user."""
    role_id = user_doc.get("role_id")
    role_doc = None
    if role_id:
        try:
            role_doc = await db["roles"].find_one({"_id": ObjectId(role_id)})
        except Exception:
            pass
    return _serialize_user(user_doc, role_doc)


async def list_users(
    db: AsyncIOMotorDatabase,
    search: str = "",
    status: str = "",
    role_id: str = "",
    page: int = 1,
    limit: int = 20,
) -> dict:
    query: dict = {}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
        ]
    if status:
        query["status"] = status
    if role_id:
        query["role_id"] = role_id

    total = await db["users"].count_documents(query)
    skip = (page - 1) * limit
    cursor = db["users"].find(query, {"hashed_password": 0}).sort("created_at", -1).skip(skip).limit(limit)
    docs = await cursor.to_list(length=limit)

    users = []
    for doc in docs:
        users.append(await _with_role(db, doc))

    return {
        "users": users,
        "total": total,
        "page": page,
        "pages": math.ceil(total / limit) if limit else 1,
    }


async def get_user(db: AsyncIOMotorDatabase, user_id: str) -> dict:
    try:
        oid = ObjectId(user_id)
    except InvalidId:
        raise ValueError("Invalid user ID")
    doc = await db["users"].find_one({"_id": oid}, {"hashed_password": 0})
    if not doc:
        raise ValueError("User not found")
    return await _with_role(db, doc)


async def create_user(
    db: AsyncIOMotorDatabase, data: CreateUserRequest, caller: Optional[dict] = None
) -> dict:
    existing = await db["users"].find_one({"email": data.email.lower()})
    if existing:
        raise ValueError("Email already in use")

    # Validate role_id + enforce assignment rules
    role_doc = await _check_role_assignment(db, caller or {}, data.role_id)

    now = datetime.now(timezone.utc)
    doc = {
        "name": data.name,
        "email": data.email.lower(),
        "hashed_password": _pwd.hash(data.password),
        "role_id": data.role_id,
        "designation": data.designation or "",
        "status": data.status,
        "whatsapp_phone": data.whatsapp_phone or "",
        # Legacy fields kept for compatibility
        "role": "user",
        "plan": "free",
        "is_active": data.status == "active",
        "created_at": now,
        "updated_at": now,
    }
    result = await db["users"].insert_one(doc)
    doc["_id"] = result.inserted_id
    return _serialize_user(doc, role_doc)


async def update_user(
    db: AsyncIOMotorDatabase, user_id: str, data: UpdateUserRequest, caller: Optional[dict] = None
) -> dict:
    try:
        oid = ObjectId(user_id)
    except InvalidId:
        raise ValueError("Invalid user ID")

    doc = await db["users"].find_one({"_id": oid})
    if not doc:
        raise ValueError("User not found")

    patch: dict = {"updated_at": datetime.now(timezone.utc)}

    if data.name is not None:
        patch["name"] = data.name
    if data.email is not None:
        clash = await db["users"].find_one({"email": data.email.lower(), "_id": {"$ne": oid}})
        if clash:
            raise ValueError("Email already in use")
        patch["email"] = data.email.lower()
    if data.password is not None:
        patch["hashed_password"] = _pwd.hash(data.password)
    if data.role_id is not None:
        # Validate role exists AND caller is allowed to assign it
        await _check_role_assignment(db, caller or {}, data.role_id)
        patch["role_id"] = data.role_id
    if data.designation is not None:
        patch["designation"] = data.designation
    if data.status is not None:
        patch["status"] = data.status
        patch["is_active"] = data.status == "active"
    if data.whatsapp_phone is not None:
        patch["whatsapp_phone"] = data.whatsapp_phone

    await db["users"].update_one({"_id": oid}, {"$set": patch})
    updated = await db["users"].find_one({"_id": oid}, {"hashed_password": 0})
    return await _with_role(db, updated)


async def delete_user(db: AsyncIOMotorDatabase, user_id: str, current_user_id: str) -> None:
    try:
        oid = ObjectId(user_id)
    except InvalidId:
        raise ValueError("Invalid user ID")

    if user_id == current_user_id:
        raise ValueError("Cannot delete your own account")

    doc = await db["users"].find_one({"_id": oid})
    if not doc:
        raise ValueError("User not found")

    # Block deleting a Super Admin user
    role_id = doc.get("role_id")
    if role_id:
        try:
            role_doc = await db["roles"].find_one({"_id": ObjectId(role_id)})
            if role_doc and role_doc.get("is_system_role") and role_doc.get("role_name") == "Super Admin":
                raise ValueError("Cannot delete a Super Admin user")
        except ValueError:
            raise
        except Exception:
            pass

    await db["users"].delete_one({"_id": oid})
