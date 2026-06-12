from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.database import get_db
from app.middleware.auth import get_current_user
from app.services.notification_service import (
    check_due_reminders,
    list_notifications,
    mark_all_read,
    mark_read,
)
from app.utils.response import error_response, success_response

router = APIRouter(prefix="/api/v1/notifications", tags=["notifications"])


@router.get("")
async def get_notifications(
    limit: int = Query(default=20, ge=1, le=100),
    unread_only: bool = Query(default=False),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    uid = str(current_user["_id"])
    # Fire any pending due-date reminders before returning the list
    await check_due_reminders(db, uid)
    data = await list_notifications(db, uid, limit, unread_only)
    return success_response(data, "Notifications retrieved")


@router.patch("/{notification_id}/read")
async def read_notification(
    notification_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    found = await mark_read(db, notification_id, str(current_user["_id"]))
    if not found:
        return error_response("Notification not found", status_code=404)
    return success_response(None, "Notification marked as read")


@router.post("/read-all")
async def read_all_notifications(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    count = await mark_all_read(db, str(current_user["_id"]))
    return success_response({"marked_read": count}, f"Marked {count} notification(s) as read")
