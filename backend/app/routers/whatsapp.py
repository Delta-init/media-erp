"""WhatsApp router — test endpoint + user phone management."""
from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel

from app.database import get_db
from app.middleware.auth import get_current_user
from app.services.whatsapp_service import send_text
from app.utils.response import error_response, success_response

router = APIRouter(prefix="/api/v1/whatsapp", tags=["whatsapp"])


class PhoneUpdate(BaseModel):
    whatsapp_phone: str


@router.post("/test")
async def test_whatsapp(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Send a test WhatsApp message to confirm the integration is working."""
    ok = await send_text(
        "+918606924500",
        "✅ its done — WhatsApp notifications are working from mediaERP!",
    )
    if ok:
        return success_response(message="Test message sent to +91 8606924500")
    return error_response("Failed to send — check WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID in .env", 500)


@router.put("/phone")
async def update_whatsapp_phone(
    body: PhoneUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Save the current user's WhatsApp phone number for notifications."""
    from bson import ObjectId
    uid = current_user["_id"]
    await db["users"].update_one(
        {"_id": ObjectId(str(uid))},
        {"$set": {"whatsapp_phone": body.whatsapp_phone}},
    )
    return success_response(message="WhatsApp phone updated")
