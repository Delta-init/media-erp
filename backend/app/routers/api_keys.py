"""
API Key management — programmatic access for third-party integrations.

Keys are stored as SHA-256 hashes. The raw key is shown only once on creation.
Format: merp_<random_48_urlsafe_chars>

Authentication: Authorization: ApiKey merp_<key>

Scopes:
  read   — GET endpoints only
  write  — GET + POST/PUT/PATCH
  admin  — all endpoints (same as a full user session)
"""
import hashlib
import secrets
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field

from app.database import get_db
from app.middleware.auth import get_current_user
from app.utils.response import error_response, success_response

router = APIRouter(prefix="/api/v1/api-keys", tags=["api-keys"])

_KEY_PREFIX = "merp_"
_KEY_BYTES  = 36   # produces 48-char urlsafe base64 string


def _generate_key() -> str:
    return _KEY_PREFIX + secrets.token_urlsafe(_KEY_BYTES)


def _hash_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode()).hexdigest()


def _serialize(doc: dict) -> dict:
    return {
        "id":          str(doc["_id"]),
        "name":        doc.get("name", ""),
        "key_prefix":  doc.get("key_prefix", ""),   # e.g. "merp_AbCd…" (first 12 chars)
        "scopes":      doc.get("scopes", ["read"]),
        "last_used_at": doc["last_used_at"].isoformat() if doc.get("last_used_at") else None,
        "created_at":   doc["created_at"].isoformat(),
        "expires_at":   doc["expires_at"].isoformat() if doc.get("expires_at") else None,
        "is_active":    doc.get("is_active", True),
    }


# ── Schemas ───────────────────────────────────────────────────────────────────

class CreateKeyBody(BaseModel):
    name:   str         = Field(..., min_length=1, max_length=100)
    scopes: list[str]   = Field(default=["read"])
    expires_days: Optional[int] = Field(default=None, ge=1, le=3650)

    def clean_scopes(self) -> list[str]:
        valid = {"read", "write", "admin"}
        return list({s for s in self.scopes if s in valid}) or ["read"]


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("")
async def list_api_keys(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """List all API keys for the current user (hashes never returned)."""
    user_id = str(current_user["_id"])
    cursor = db["api_keys"].find({"user_id": user_id}).sort("created_at", -1)
    docs = await cursor.to_list(200)
    return success_response(data=[_serialize(d) for d in docs], message="API keys retrieved")


@router.post("", status_code=201)
async def create_api_key(
    body: CreateKeyBody,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Create a new API key.
    The full key is returned **once** — store it immediately.
    """
    user_id = str(current_user["_id"])

    raw_key   = _generate_key()
    key_hash  = _hash_key(raw_key)
    key_prefix = raw_key[:16] + "…"   # show first 16 chars as hint

    now = datetime.now(timezone.utc)
    expires_at = None
    if body.expires_days:
        from datetime import timedelta
        expires_at = now + timedelta(days=body.expires_days)

    doc = {
        "user_id":     user_id,
        "name":        body.name,
        "key_hash":    key_hash,
        "key_prefix":  key_prefix,
        "scopes":      body.clean_scopes(),
        "last_used_at": None,
        "expires_at":  expires_at,
        "is_active":   True,
        "created_at":  now,
    }
    result = await db["api_keys"].insert_one(doc)
    doc["_id"] = result.inserted_id

    return success_response(
        data={
            **_serialize(doc),
            "key": raw_key,   # shown only once
        },
        message="API key created — copy it now, it won't be shown again",
        status_code=201,
    )


@router.delete("/{key_id}", status_code=204)
async def revoke_api_key(
    key_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Permanently revoke (delete) an API key."""
    user_id = str(current_user["_id"])
    try:
        oid = ObjectId(key_id)
    except (InvalidId, Exception):
        return error_response("Invalid key ID", status_code=400)

    result = await db["api_keys"].delete_one({"_id": oid, "user_id": user_id})
    if result.deleted_count == 0:
        return error_response("API key not found", status_code=404)
    from fastapi.responses import Response
    return Response(status_code=204)


@router.patch("/{key_id}/toggle")
async def toggle_api_key(
    key_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Enable or disable an API key without deleting it."""
    user_id = str(current_user["_id"])
    try:
        oid = ObjectId(key_id)
    except (InvalidId, Exception):
        return error_response("Invalid key ID", status_code=400)

    doc = await db["api_keys"].find_one({"_id": oid, "user_id": user_id})
    if doc is None:
        return error_response("API key not found", status_code=404)

    new_state = not doc.get("is_active", True)
    await db["api_keys"].update_one(
        {"_id": oid},
        {"$set": {"is_active": new_state}},
    )
    return success_response(
        data={"is_active": new_state},
        message=f"API key {'enabled' if new_state else 'disabled'}",
    )


# ── Auth helper (used by middleware/auth.py) ─────────────────────────────────

async def authenticate_api_key(raw_key: str, db: AsyncIOMotorDatabase) -> dict | None:
    """
    Validate a raw API key and return the user document, or None if invalid.
    Updates last_used_at on success.
    """
    if not raw_key.startswith(_KEY_PREFIX):
        return None

    key_hash = _hash_key(raw_key)
    now = datetime.now(timezone.utc)

    doc = await db["api_keys"].find_one({
        "key_hash": key_hash,
        "is_active": True,
        "$or": [
            {"expires_at": None},
            {"expires_at": {"$gt": now}},
        ],
    })
    if doc is None:
        return None

    # Update last_used_at asynchronously (fire-and-forget)
    await db["api_keys"].update_one(
        {"_id": doc["_id"]},
        {"$set": {"last_used_at": now}},
    )

    # Load the owner user
    user = await db["users"].find_one({"_id": ObjectId(doc["user_id"])})
    if user is None or not user.get("is_active", True):
        return None

    # Attach role + scopes
    role_id = user.get("role_id")
    if role_id:
        try:
            role_doc = await db["roles"].find_one({"_id": ObjectId(role_id)})
            user["_role"] = role_doc
        except Exception:
            user["_role"] = None
    else:
        user["_role"] = None

    user["_api_key_scopes"] = doc.get("scopes", ["read"])
    return user
