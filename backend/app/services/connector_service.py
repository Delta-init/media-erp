from datetime import datetime, timezone
from typing import Optional
from bson import ObjectId
from bson.errors import InvalidId
from pymongo import ReturnDocument
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.connector import connector_doc
from app.utils.encryption import encrypt, decrypt


async def create_connector(
    user_id: str,
    platform: str,
    name: str,
    sync_frequency: str,
    db: AsyncIOMotorDatabase,
) -> dict:
    doc = connector_doc(user_id, platform, name, sync_frequency)
    result = await db["connectors"].insert_one(doc)
    doc["_id"] = result.inserted_id
    return doc


async def get_connector(
    connector_id: str,
    user_id: str,
    db: AsyncIOMotorDatabase,
) -> Optional[dict]:
    try:
        oid = ObjectId(connector_id)
    except InvalidId:
        return None
    return await db["connectors"].find_one({"_id": oid, "user_id": user_id})


async def list_connectors(user_id: str, db: AsyncIOMotorDatabase) -> list[dict]:
    cursor = db["connectors"].find({"user_id": user_id}).sort("created_at", -1)
    return await cursor.to_list(length=200)


async def update_connector(
    connector_id: str,
    user_id: str,
    updates: dict,
    db: AsyncIOMotorDatabase,
) -> Optional[dict]:
    try:
        oid = ObjectId(connector_id)
    except InvalidId:
        return None
    updates["updated_at"] = datetime.now(timezone.utc)
    return await db["connectors"].find_one_and_update(
        {"_id": oid, "user_id": user_id},
        {"$set": updates},
        return_document=ReturnDocument.AFTER,
    )


async def delete_connector(
    connector_id: str,
    user_id: str,
    db: AsyncIOMotorDatabase,
) -> bool:
    try:
        oid = ObjectId(connector_id)
    except InvalidId:
        return False
    result = await db["connectors"].delete_one({"_id": oid, "user_id": user_id})
    return result.deleted_count == 1


async def save_tokens(
    connector_id: str,
    user_id: str,
    access_token: str,
    refresh_token: Optional[str],
    expires_at: Optional[datetime],
    platform_account_id: Optional[str],
    db: AsyncIOMotorDatabase,
) -> Optional[dict]:
    updates = {
        "encrypted_access_token": encrypt(access_token),
        "status": "connected",
        "token_expires_at": expires_at,
        "platform_account_id": platform_account_id,
        "error_message": None,
    }
    if refresh_token:
        updates["encrypted_refresh_token"] = encrypt(refresh_token)
    return await update_connector(connector_id, user_id, updates, db)


_DEMO_TOKEN = "demo_token_placeholder"

def _safe_decrypt(value: str | None) -> str | None:
    """Decrypt an encrypted token, or pass through demo/plain tokens as-is."""
    if not value:
        return None
    if value == _DEMO_TOKEN:
        return value
    try:
        return decrypt(value)
    except Exception:
        return value  # already plain-text or unrecognised format


def get_decrypted_tokens(connector: dict) -> dict:
    return {
        "access_token": _safe_decrypt(connector.get("encrypted_access_token")),
        "refresh_token": _safe_decrypt(connector.get("encrypted_refresh_token")),
    }
