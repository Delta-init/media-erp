"""
Audit log viewer — Feature 16.
Read-only access to the current user's audit trail.
"""
import logging
from datetime import datetime
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.database import get_db
from app.middleware.auth import get_current_user
from app.utils.response import error_response, success_response

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/audit-logs", tags=["audit-logs"])


# ── Helpers ───────────────────────────────────────────────────────────────────

def _serialize_log(doc: dict) -> dict:
    """Convert a MongoDB audit_logs document to a JSON-serialisable dict."""
    created_at = doc.get("created_at")
    return {
        "id": str(doc["_id"]),
        "user_id": doc.get("user_id", ""),
        "action": doc.get("action", ""),
        "resource_type": doc.get("resource_type", ""),
        "resource_id": doc.get("resource_id"),
        "details": doc.get("details", {}),
        "ip_address": doc.get("ip_address"),
        "created_at": created_at.isoformat() if isinstance(created_at, datetime) else created_at,
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("", summary="List audit logs for the current user")
async def list_audit_logs(
    limit: int = Query(default=50, ge=1, le=100, description="Max records to return"),
    offset: int = Query(default=0, ge=0, description="Number of records to skip"),
    action: Optional[str] = Query(default=None, description="Filter by action"),
    resource_type: Optional[str] = Query(default=None, description="Filter by resource type"),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = str(current_user["_id"])

    query: dict = {"user_id": user_id}
    if action:
        query["action"] = action
    if resource_type:
        query["resource_type"] = resource_type

    total = await db["audit_logs"].count_documents(query)
    cursor = (
        db["audit_logs"]
        .find(query)
        .sort("created_at", -1)
        .skip(offset)
        .limit(limit)
    )
    logs = [_serialize_log(doc) async for doc in cursor]

    return success_response(
        data={"logs": logs, "total": total},
        message="Audit logs retrieved",
    )
