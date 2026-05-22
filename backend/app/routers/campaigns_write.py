"""
Campaign write operations — Phase 1.
Pause, resume, and update budgets for Facebook Ads campaigns via the Marketing API.
"""
import logging
from typing import Optional

import httpx
from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel

from app.database import get_db
from app.middleware.auth import get_current_user
from app.utils.encryption import decrypt
from app.utils.response import error_response, success_response

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/campaigns", tags=["campaigns-write"])

_GRAPH_BASE = "https://graph.facebook.com/v21.0"


# ── Schemas ───────────────────────────────────────────────────────────────────

class BudgetUpdateBody(BaseModel):
    connector_id: str
    daily_budget: float  # USD — will be converted to cents for the API


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _find_connector_for_campaign(
    db: AsyncIOMotorDatabase,
    campaign_id: str,
    user_id: str,
) -> Optional[dict]:
    """
    Look up the connector for a campaign by scanning marketing_data.
    Returns the connector document or None.
    """
    row = await db["marketing_data"].find_one({
        "campaign_id": campaign_id,
        "platform": "facebook_ads",
        "user_id": user_id,
    })
    if not row:
        return None

    connector_id = row.get("connector_id")
    if not connector_id:
        return None

    try:
        oid = ObjectId(connector_id)
    except InvalidId:
        return None

    return await db["connectors"].find_one({"_id": oid, "user_id": user_id})


def _extract_fb_error(resp: httpx.Response) -> str:
    """Pull the human-readable message out of a Facebook API error response."""
    try:
        body = resp.json()
        err = body.get("error", {})
        return err.get("error_user_msg") or err.get("message") or f"HTTP {resp.status_code}"
    except Exception:
        return f"HTTP {resp.status_code}"


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/write/connectors", summary="List facebook_ads connectors available for write operations")
async def list_write_connectors(
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Return user's facebook_ads connectors that have an access token (can write)."""
    user_id = str(current_user["_id"])

    cursor = db["connectors"].find({
        "user_id": user_id,
        "platform": "facebook_ads",
        "encrypted_access_token": {"$exists": True, "$ne": None},
    })

    connectors = []
    async for doc in cursor:
        connectors.append({
            "id": str(doc["_id"]),
            "name": doc.get("name", ""),
            "platform": doc.get("platform", ""),
            "status": doc.get("status", ""),
            "account_id": doc.get("platform_account_id", ""),
        })

    return success_response(data=connectors, message="Write-capable connectors retrieved")


@router.post("/{campaign_id}/pause", summary="Pause a Facebook Ads campaign")
async def pause_campaign(
    campaign_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Set a Facebook Ads campaign status to PAUSED."""
    user_id = str(current_user["_id"])

    connector = await _find_connector_for_campaign(db, campaign_id, user_id)
    if not connector:
        return error_response(
            message=f"No facebook_ads connector found for campaign '{campaign_id}'",
            status_code=404,
        )

    try:
        access_token = decrypt(connector["encrypted_access_token"])
    except Exception as exc:
        logger.error("Token decryption failed for connector %s: %s", connector["_id"], exc)
        return error_response(message="Failed to decrypt connector token", status_code=500)

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{_GRAPH_BASE}/{campaign_id}",
                params={"access_token": access_token, "status": "PAUSED"},
            )
        if not resp.is_success:
            msg = _extract_fb_error(resp)
            logger.warning("Facebook pause campaign %s failed: %s", campaign_id, msg)
            return error_response(message=f"Facebook API error: {msg}", status_code=resp.status_code)
    except httpx.RequestError as exc:
        logger.error("HTTP error pausing campaign %s: %s", campaign_id, exc)
        return error_response(message="Failed to reach Facebook API", status_code=502)

    return success_response(
        data={"campaign_id": campaign_id, "status": "PAUSED"},
        message="Campaign paused successfully",
    )


@router.post("/{campaign_id}/resume", summary="Resume a Facebook Ads campaign")
async def resume_campaign(
    campaign_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Set a Facebook Ads campaign status to ACTIVE."""
    user_id = str(current_user["_id"])

    connector = await _find_connector_for_campaign(db, campaign_id, user_id)
    if not connector:
        return error_response(
            message=f"No facebook_ads connector found for campaign '{campaign_id}'",
            status_code=404,
        )

    try:
        access_token = decrypt(connector["encrypted_access_token"])
    except Exception as exc:
        logger.error("Token decryption failed for connector %s: %s", connector["_id"], exc)
        return error_response(message="Failed to decrypt connector token", status_code=500)

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{_GRAPH_BASE}/{campaign_id}",
                params={"access_token": access_token, "status": "ACTIVE"},
            )
        if not resp.is_success:
            msg = _extract_fb_error(resp)
            logger.warning("Facebook resume campaign %s failed: %s", campaign_id, msg)
            return error_response(message=f"Facebook API error: {msg}", status_code=resp.status_code)
    except httpx.RequestError as exc:
        logger.error("HTTP error resuming campaign %s: %s", campaign_id, exc)
        return error_response(message="Failed to reach Facebook API", status_code=502)

    return success_response(
        data={"campaign_id": campaign_id, "status": "ACTIVE"},
        message="Campaign resumed successfully",
    )


@router.patch("/{campaign_id}/budget", summary="Update daily budget for a Facebook Ads campaign")
async def update_campaign_budget(
    campaign_id: str,
    body: BudgetUpdateBody,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Update a campaign's daily_budget.
    Facebook Marketing API uses minor currency units (cents), so USD is multiplied by 100.
    """
    user_id = str(current_user["_id"])

    if body.daily_budget <= 0:
        return error_response(message="daily_budget must be a positive number", status_code=422)

    # Load connector by the provided connector_id (body-supplied, not auto-detected)
    try:
        connector_oid = ObjectId(body.connector_id)
    except InvalidId:
        return error_response(message="Invalid connector_id", status_code=422)

    connector = await db["connectors"].find_one({
        "_id": connector_oid,
        "user_id": user_id,
        "platform": "facebook_ads",
    })
    if not connector:
        return error_response(message="Connector not found or access denied", status_code=404)

    try:
        access_token = decrypt(connector["encrypted_access_token"])
    except Exception as exc:
        logger.error("Token decryption failed for connector %s: %s", connector["_id"], exc)
        return error_response(message="Failed to decrypt connector token", status_code=500)

    # Facebook uses minor currency units (cents)
    daily_budget_cents = int(body.daily_budget * 100)

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{_GRAPH_BASE}/{campaign_id}",
                params={
                    "access_token": access_token,
                    "daily_budget": daily_budget_cents,
                },
            )
        if not resp.is_success:
            msg = _extract_fb_error(resp)
            logger.warning("Facebook budget update campaign %s failed: %s", campaign_id, msg)
            return error_response(message=f"Facebook API error: {msg}", status_code=resp.status_code)
    except httpx.RequestError as exc:
        logger.error("HTTP error updating budget for campaign %s: %s", campaign_id, exc)
        return error_response(message="Failed to reach Facebook API", status_code=502)

    return success_response(
        data={
            "campaign_id": campaign_id,
            "daily_budget_usd": body.daily_budget,
            "daily_budget_cents": daily_budget_cents,
        },
        message="Campaign daily budget updated successfully",
    )
