"""
White-label branding settings — Feature 18.
Stores per-user branding (logo URL, colors, company name) and injects it into
PDF/Excel exports and email reports.
"""
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel

from app.database import get_db
from app.middleware.auth import get_current_user
from app.utils.response import success_response
from app.utils.timezone import utc_iso

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/whitelabel", tags=["whitelabel"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class BrandingUpdate(BaseModel):
    company_name: Optional[str] = None
    logo_url: Optional[str] = None
    primary_color: Optional[str] = None   # hex e.g. "#6366f1"
    accent_color: Optional[str] = None    # hex
    footer_text: Optional[str] = None
    report_title_prefix: Optional[str] = None  # prepended to report titles
    hide_mediaerp_branding: bool = False
    custom_font: Optional[str] = None     # future use


# ── Defaults ──────────────────────────────────────────────────────────────────

DEFAULT_BRANDING = {
    "company_name": "mediaERP",
    "logo_url": None,
    "primary_color": "#18181b",
    "accent_color": "#facc15",
    "footer_text": "Powered by mediaERP — Carlton Trading Academy",
    "report_title_prefix": None,
    "hide_mediaerp_branding": False,
    "custom_font": None,
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _ser(doc: dict) -> dict:
    def _dt(v): return utc_iso(v)
    return {
        "user_id": doc.get("user_id", ""),
        "company_name": doc.get("company_name", DEFAULT_BRANDING["company_name"]),
        "logo_url": doc.get("logo_url"),
        "primary_color": doc.get("primary_color", DEFAULT_BRANDING["primary_color"]),
        "accent_color": doc.get("accent_color", DEFAULT_BRANDING["accent_color"]),
        "footer_text": doc.get("footer_text", DEFAULT_BRANDING["footer_text"]),
        "report_title_prefix": doc.get("report_title_prefix"),
        "hide_mediaerp_branding": doc.get("hide_mediaerp_branding", False),
        "custom_font": doc.get("custom_font"),
        "updated_at": _dt(doc.get("updated_at")),
    }


async def get_branding(db: AsyncIOMotorDatabase, user_id: str) -> dict:
    """Public helper used by export.py and email_service.py."""
    doc = await db["whitelabel"].find_one({"user_id": user_id})
    if doc:
        return _ser(doc)
    return {**DEFAULT_BRANDING, "user_id": user_id, "updated_at": None}


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/settings", summary="Get current branding settings")
async def get_settings(
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = str(current_user["_id"])
    branding = await get_branding(db, user_id)
    return success_response(data=branding, message="Branding settings retrieved")


@router.put("/settings", summary="Update branding settings")
async def update_settings(
    body: BrandingUpdate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = str(current_user["_id"])
    updates = {k: v for k, v in body.model_dump().items() if v is not None or k == "hide_mediaerp_branding"}
    updates["updated_at"] = datetime.now(timezone.utc)
    updates["user_id"] = user_id

    await db["whitelabel"].update_one(
        {"user_id": user_id},
        {"$set": updates},
        upsert=True,
    )
    branding = await get_branding(db, user_id)
    return success_response(data=branding, message="Branding settings updated")


@router.delete("/settings", summary="Reset branding to defaults")
async def reset_settings(
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = str(current_user["_id"])
    await db["whitelabel"].delete_one({"user_id": user_id})
    return success_response(data={**DEFAULT_BRANDING, "user_id": user_id}, message="Branding reset to defaults")
