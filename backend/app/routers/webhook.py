"""
Meta (Facebook / Instagram) Webhook
=====================================
GET  /api/v1/webhooks/facebook  — hub.challenge verification
POST /api/v1/webhooks/facebook  — receive real-time events

When a DM arrives the handler:
  1. Looks up the connector that owns the page / IG account
  2. Persists the message to the `social_messages` collection
  3. Creates an in-app notification for the connector owner
"""
import hashlib
import hmac
import json
import logging
from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, Response
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.config import settings
from app.database import get_db
from app.models.notification import notification_doc

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/webhooks", tags=["webhooks"])


# ── Verification handshake ────────────────────────────────────────────────────

@router.get("/facebook")
async def facebook_verify(
    hub_mode: str = Query(alias="hub.mode", default=""),
    hub_verify_token: str = Query(alias="hub.verify_token", default=""),
    hub_challenge: str = Query(alias="hub.challenge", default=""),
):
    """Meta calls this once to verify the endpoint owns the URL."""
    if hub_mode == "subscribe" and hub_verify_token == settings.facebook_webhook_verify_token:
        logger.info("Facebook webhook verified successfully")
        return Response(content=hub_challenge, media_type="text/plain")
    logger.warning("Facebook webhook verification failed — bad verify_token")
    raise HTTPException(status_code=403, detail="Verification token mismatch")


# ── Event receiver ────────────────────────────────────────────────────────────

def _verify_signature(body: bytes, x_hub_signature_256: str) -> bool:
    """Validate that the payload was signed by Meta using the app secret."""
    if not x_hub_signature_256:
        return False
    expected = "sha256=" + hmac.new(
        settings.facebook_app_secret.encode(),
        body,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, x_hub_signature_256)


@router.post("/facebook")
async def facebook_events(
    request: Request,
    x_hub_signature_256: str = Header(default=""),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Receive and route Meta webhook events."""
    body = await request.body()

    # Signature check (skip in dev if secret not set)
    if settings.facebook_app_secret:
        if not _verify_signature(body, x_hub_signature_256):
            logger.warning("Facebook webhook signature mismatch — ignoring payload")
            raise HTTPException(status_code=403, detail="Invalid signature")

    try:
        payload: dict[str, Any] = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    object_type = payload.get("object", "")
    entries = payload.get("entry", [])

    for entry in entries:
        entry_id = entry.get("id", "")

        # ── Instagram messaging (via Facebook Page or Instagram Login) ─────
        for messaging in entry.get("messaging", []):
            await _handle_messaging(db, object_type, entry_id, messaging)

        # ── Instagram-specific changes ─────────────────────────────────────
        for change in entry.get("changes", []):
            await _handle_change(db, object_type, entry_id, change)

    # Meta expects a fast 200 OK — heavy processing should be async
    return Response(status_code=200)


async def _handle_messaging(
    db: AsyncIOMotorDatabase,
    object_type: str,
    page_id: str,
    messaging: dict,
) -> None:
    sender_id   = messaging.get("sender",    {}).get("id", "")
    recipient_id = messaging.get("recipient", {}).get("id", "")

    if "message" in messaging:
        msg  = messaging["message"]
        text = msg.get("text", "")
        mid  = msg.get("mid", "")
        logger.info(
            "[Webhook] %s DM | page=%s sender=%s mid=%s text=%r",
            object_type, page_id, sender_id, mid, text[:80],
        )

        # ── Persist message ────────────────────────────────────────────────
        await _persist_dm(
            db,
            platform=object_type,       # "instagram" | "page"
            page_id=page_id,
            mid=mid,
            sender_id=sender_id,
            recipient_id=recipient_id,
            text=text,
            raw=messaging,
        )

    elif "read" in messaging:
        logger.debug("[Webhook] Message-read receipt | page=%s sender=%s", page_id, sender_id)

    elif "delivery" in messaging:
        logger.debug("[Webhook] Message-delivery receipt | page=%s sender=%s", page_id, sender_id)


async def _handle_change(
    db: AsyncIOMotorDatabase,
    object_type: str,
    page_id: str,
    change: dict,
) -> None:
    field = change.get("field", "")
    logger.info("[Webhook] Change | object=%s page=%s field=%s", object_type, page_id, field)
    # TODO: handle feed / mention / comment changes


# ── DM persistence ────────────────────────────────────────────────────────────

async def _persist_dm(
    db: AsyncIOMotorDatabase,
    *,
    platform: str,
    page_id: str,
    mid: str,
    sender_id: str,
    recipient_id: str,
    text: str,
    raw: dict,
) -> None:
    """
    Save an incoming DM to `social_messages` and notify the connector owner.

    Connector lookup: match `platform_account_id` == page_id for both
    facebook_pages / instagram connectors (page_id is the entry.id from Meta).
    """
    # Skip bot self-echo (sender == page itself)
    if sender_id == page_id:
        return

    # Deduplicate by mid
    if mid and await db["social_messages"].find_one({"mid": mid}):
        return

    # ── Find connector owner ───────────────────────────────────────────────────
    # The webhook `page_id` corresponds to platform_account_id in our connectors.
    connector = await db["connectors"].find_one(
        {
            "platform_account_id": page_id,
            "platform": {"$in": ["facebook_pages", "instagram", "instagram_login"]},
            "status": "connected",
        }
    )
    user_id: str | None = connector.get("user_id") if connector else None

    # ── Insert message doc ─────────────────────────────────────────────────────
    now = datetime.now(timezone.utc)
    doc = {
        "mid":          mid,
        "platform":     platform,
        "page_id":      page_id,
        "sender_id":    sender_id,
        "recipient_id": recipient_id,
        "text":         text,
        "direction":    "inbound",
        "connector_id": str(connector["_id"]) if connector else None,
        "user_id":      user_id,
        "raw":          raw,
        "created_at":   now,
    }
    try:
        await db["social_messages"].insert_one(doc)
        logger.info("[Webhook] DM persisted | platform=%s page=%s mid=%s", platform, page_id, mid)
    except Exception as exc:
        logger.error("[Webhook] Failed to persist DM: %s", exc)
        return

    # ── Notify connector owner ─────────────────────────────────────────────────
    if user_id:
        try:
            platform_label = {
                "instagram": "Instagram",
                "instagram_login": "Instagram",
                "facebook_pages": "Facebook",
            }.get(connector.get("platform", ""), "Social")
            notif = notification_doc(
                user_id=user_id,
                notification_type="social_dm",
                title=f"New {platform_label} message",
                message=text[:120] if text else "New direct message received",
                metadata={
                    "platform":   platform,
                    "page_id":    page_id,
                    "sender_id":  sender_id,
                    "mid":        mid,
                },
            )
            await db["notifications"].insert_one(notif)
        except Exception as exc:
            logger.warning("[Webhook] Failed to create DM notification: %s", exc)


# ── Instagram deauthorize & data deletion ─────────────────────────────────────

@router.get("/instagram/deauthorize")
@router.post("/instagram/deauthorize")
async def instagram_deauthorize(request: Request):
    """
    Called by Meta when a user removes your app from their Instagram account.
    Must return 200 quickly.
    """
    try:
        body = await request.body()
        if body:
            data = json.loads(body)
            user_id = data.get("user_id", "unknown")
            logger.info("[Webhook] Instagram deauthorize | ig_user_id=%s", user_id)
    except Exception:
        pass
    return Response(status_code=200)


@router.get("/instagram/delete")
@router.post("/instagram/delete")
async def instagram_data_deletion(request: Request):
    """
    Called by Meta when a user requests deletion of their data.
    Must return a confirmation_code and status_url.
    """
    try:
        body = await request.body()
        if body:
            data = json.loads(body)
            user_id = data.get("user_id", "unknown")
            logger.info("[Webhook] Instagram data deletion request | ig_user_id=%s", user_id)
    except Exception:
        pass
    # Meta requires a JSON response with confirmation_code
    return {
        "url": f"{settings.frontend_url}/privacy/data-deletion",
        "confirmation_code": "mediaerp_deletion_confirmed",
    }
