"""
Client / Agency management — Feature 10.
Agencies can manage multiple client workspaces, each with their own connectors
and data, all visible from a central agency dashboard.
"""
import logging
import secrets
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel

from app.database import get_db
from app.middleware.auth import get_current_user
from app.utils.response import error_response, success_response

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/clients", tags=["clients"])

# ── Schemas ───────────────────────────────────────────────────────────────────

class ClientCreate(BaseModel):
    name: str
    company: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    industry: Optional[str] = None
    notes: Optional[str] = None
    color: Optional[str] = None   # hex color for avatar

class ClientUpdate(BaseModel):
    name: Optional[str] = None
    company: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    industry: Optional[str] = None
    notes: Optional[str] = None
    color: Optional[str] = None
    status: Optional[str] = None  # "active" | "inactive" | "prospect"

# ── Serializers ───────────────────────────────────────────────────────────────

def _ser(doc: dict) -> dict:
    def _dt(v): return v.isoformat() if isinstance(v, datetime) else v
    return {
        "id": str(doc["_id"]),
        "agency_user_id": doc.get("agency_user_id", ""),
        "name": doc.get("name", ""),
        "company": doc.get("company"),
        "email": doc.get("email"),
        "phone": doc.get("phone"),
        "website": doc.get("website"),
        "industry": doc.get("industry"),
        "notes": doc.get("notes"),
        "color": doc.get("color", "#6366f1"),
        "status": doc.get("status", "active"),
        "invite_token": doc.get("invite_token"),
        "invited_at": _dt(doc.get("invited_at")),
        "accepted_at": _dt(doc.get("accepted_at")),
        "connector_count": doc.get("connector_count", 0),
        "total_spend_30d": doc.get("total_spend_30d", 0.0),
        "created_at": _dt(doc.get("created_at")),
        "updated_at": _dt(doc.get("updated_at")),
    }

# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("", summary="List all clients for the agency")
async def list_clients(
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = str(current_user["_id"])
    query: dict = {"agency_user_id": user_id}
    if status:
        query["status"] = status
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"company": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
        ]

    cursor = db["clients"].find(query).sort("created_at", -1)
    clients = []
    async for doc in cursor:
        # Augment with live connector count
        cid = str(doc["_id"])
        conn_count = await db["connectors"].count_documents({"client_id": cid})
        doc["connector_count"] = conn_count
        clients.append(_ser(doc))

    return success_response(data=clients, message=f"{len(clients)} client(s) found")


@router.post("", summary="Create a new client")
async def create_client(
    body: ClientCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = str(current_user["_id"])
    now = datetime.now(timezone.utc)
    doc = {
        "agency_user_id": user_id,
        "name": body.name,
        "company": body.company,
        "email": body.email,
        "phone": body.phone,
        "website": body.website,
        "industry": body.industry,
        "notes": body.notes,
        "color": body.color or "#6366f1",
        "status": "active",
        "invite_token": None,
        "invited_at": None,
        "accepted_at": None,
        "total_spend_30d": 0.0,
        "created_at": now,
        "updated_at": now,
    }
    result = await db["clients"].insert_one(doc)
    doc["_id"] = result.inserted_id
    doc["connector_count"] = 0
    return success_response(data=_ser(doc), message="Client created")


@router.get("/:id/summary", summary="Get client summary with stats")
async def get_client_summary(
    id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = str(current_user["_id"])
    try:
        oid = ObjectId(id)
    except InvalidId:
        return error_response(message="Invalid client ID", status_code=422)

    doc = await db["clients"].find_one({"_id": oid, "agency_user_id": user_id})
    if not doc:
        return error_response(message="Client not found", status_code=404)

    cid = str(doc["_id"])
    conn_count = await db["connectors"].count_documents({"client_id": cid})
    doc["connector_count"] = conn_count

    # 30-day spend
    from datetime import timedelta
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    thirty_ago = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d")
    pipeline = [
        {"$match": {"client_id": cid, "date": {"$gte": thirty_ago, "$lte": today}}},
        {"$group": {"_id": None, "total": {"$sum": "$metrics.spend"}}},
    ]
    result = await db["marketing_data"].aggregate(pipeline).to_list(1)
    doc["total_spend_30d"] = round(result[0]["total"], 2) if result else 0.0

    # Platform breakdown
    pipeline2 = [
        {"$match": {"client_id": cid, "date": {"$gte": thirty_ago, "$lte": today}}},
        {"$group": {"_id": "$platform", "spend": {"$sum": "$metrics.spend"}, "impressions": {"$sum": "$metrics.impressions"}}},
    ]
    platform_breakdown = await db["marketing_data"].aggregate(pipeline2).to_list(None)

    serialized = _ser(doc)
    serialized["platform_breakdown"] = [
        {"platform": r["_id"], "spend": round(r["spend"], 2), "impressions": r["impressions"]}
        for r in platform_breakdown
    ]
    return success_response(data=serialized, message="Client summary retrieved")


@router.patch("/{client_id}", summary="Update a client")
async def update_client(
    client_id: str,
    body: ClientUpdate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = str(current_user["_id"])
    try:
        oid = ObjectId(client_id)
    except InvalidId:
        return error_response(message="Invalid client ID", status_code=422)

    updates = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    if not updates:
        return error_response(message="No fields to update", status_code=422)

    if "status" in updates and updates["status"] not in ("active", "inactive", "prospect"):
        return error_response(message="status must be active, inactive, or prospect", status_code=422)

    updates["updated_at"] = datetime.now(timezone.utc)
    result = await db["clients"].find_one_and_update(
        {"_id": oid, "agency_user_id": user_id},
        {"$set": updates},
        return_document=True,
    )
    if not result:
        return error_response(message="Client not found or access denied", status_code=404)

    result["connector_count"] = await db["connectors"].count_documents({"client_id": client_id})
    return success_response(data=_ser(result), message="Client updated")


@router.delete("/{client_id}", summary="Delete a client")
async def delete_client(
    client_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = str(current_user["_id"])
    try:
        oid = ObjectId(client_id)
    except InvalidId:
        return error_response(message="Invalid client ID", status_code=422)

    result = await db["clients"].delete_one({"_id": oid, "agency_user_id": user_id})
    if result.deleted_count == 0:
        return error_response(message="Client not found or access denied", status_code=404)
    return success_response(data={"id": client_id}, message="Client deleted")


@router.post("/{client_id}/invite", summary="Send client invite email")
async def invite_client(
    client_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = str(current_user["_id"])
    try:
        oid = ObjectId(client_id)
    except InvalidId:
        return error_response(message="Invalid client ID", status_code=422)

    doc = await db["clients"].find_one({"_id": oid, "agency_user_id": user_id})
    if not doc:
        return error_response(message="Client not found", status_code=404)

    if not doc.get("email"):
        return error_response(message="Client has no email address", status_code=422)

    token = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc)
    await db["clients"].update_one(
        {"_id": oid},
        {"$set": {"invite_token": token, "invited_at": now, "updated_at": now}},
    )

    # Send invite email (best-effort)
    try:
        from app.utils.email import send_email
        agency_name = current_user.get("name") or current_user.get("email", "Your agency")
        invite_url = f"{settings.frontend_url}/accept-invite?token={token}"
        html = f"""
<body style="font-family:Arial,sans-serif;background:#f5f5f5;padding:40px 0;">
  <table width="520" style="background:#fff;border-radius:12px;margin:0 auto;padding:36px;">
    <tr><td>
      <h2 style="color:#18181b;">You've been invited to mediaERP</h2>
      <p style="color:#555;">{agency_name} has invited you to view your marketing analytics dashboard.</p>
      <a href="{invite_url}"
         style="display:inline-block;background:#18181b;color:#fff;padding:12px 28px;
                border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0;">
        Accept Invitation
      </a>
      <p style="color:#999;font-size:12px;">Link expires in 7 days.</p>
    </td></tr>
  </table>
</body>"""
        await send_email(doc["email"], f"Invitation from {agency_name} — mediaERP", html, category="client_invite")
    except Exception as exc:
        logger.warning("Invite email failed: %s", exc)

    return success_response(
        data={"invite_token": token, "invited_at": now.isoformat()},
        message="Invitation sent",
    )


@router.get("/stats", summary="Agency dashboard statistics across all clients")
async def agency_stats(
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    from datetime import timedelta
    user_id = str(current_user["_id"])

    total_clients  = await db["clients"].count_documents({"agency_user_id": user_id})
    active_clients = await db["clients"].count_documents({"agency_user_id": user_id, "status": "active"})

    # Total spend across all clients last 30 days
    today      = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    thirty_ago = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d")

    client_ids = []
    async for c in db["clients"].find({"agency_user_id": user_id}, {"_id": 1}):
        client_ids.append(str(c["_id"]))

    total_spend = 0.0
    if client_ids:
        pipeline = [
            {"$match": {"client_id": {"$in": client_ids}, "date": {"$gte": thirty_ago, "$lte": today}}},
            {"$group": {"_id": None, "total": {"$sum": "$metrics.spend"}}},
        ]
        result = await db["marketing_data"].aggregate(pipeline).to_list(1)
        total_spend = round(result[0]["total"], 2) if result else 0.0

    return success_response(
        data={
            "total_clients": total_clients,
            "active_clients": active_clients,
            "prospect_clients": await db["clients"].count_documents({"agency_user_id": user_id, "status": "prospect"}),
            "total_spend_30d": total_spend,
        },
        message="Agency stats retrieved",
    )
