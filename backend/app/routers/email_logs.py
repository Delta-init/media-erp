"""
Email logs — Super Admin audit trail of every outbound email.

Every send attempt (password resets, scheduled reports, rule alerts, client
invites, SMTP tests) is recorded in the `email_logs` collection by the email
transport (`app/utils/email.py::_log_email`). This router exposes them, gated to
Super Admin only.
"""
import math

from fastapi import APIRouter, Depends, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.database import get_db
from app.middleware.auth import get_current_user
from app.utils.response import success_response

router = APIRouter(prefix="/api/v1/email-logs", tags=["email-logs"])


def _require_super_admin(current_user: dict = Depends(get_current_user)) -> dict:
    role = current_user.get("_role") or {}
    if not (role.get("is_system_role") and role.get("role_name") == "Super Admin"):
        raise HTTPException(status_code=403, detail="Super Admin access required")
    return current_user


def _serialize(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "to": doc.get("to", ""),
        "subject": doc.get("subject", ""),
        "status": doc.get("status", ""),
        "error": doc.get("error"),
        "from_email": doc.get("from_email", ""),
        "category": doc.get("category", "general"),
        "created_at": doc["created_at"].isoformat() if doc.get("created_at") else None,
    }


@router.get("")
async def list_email_logs(
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=200),
    status: str = Query("", description="sent | failed"),
    category: str = Query(""),
    search: str = Query(""),
    _: dict = Depends(_require_super_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    query: dict = {}
    if status in ("sent", "failed"):
        query["status"] = status
    if category:
        query["category"] = category
    if search:
        query["$or"] = [
            {"to": {"$regex": search, "$options": "i"}},
            {"subject": {"$regex": search, "$options": "i"}},
        ]

    total = await db["email_logs"].count_documents(query)
    skip = (page - 1) * limit
    cursor = db["email_logs"].find(query).sort("created_at", -1).skip(skip).limit(limit)
    logs = [_serialize(d) async for d in cursor]

    # Overall stats (unfiltered) for the header cards
    sent = await db["email_logs"].count_documents({"status": "sent"})
    failed = await db["email_logs"].count_documents({"status": "failed"})

    return success_response(
        data={
            "logs": logs,
            "total": total,
            "page": page,
            "pages": math.ceil(total / limit) if limit else 1,
            "stats": {"sent": sent, "failed": failed, "total": sent + failed},
        },
        message="Email logs retrieved",
    )
