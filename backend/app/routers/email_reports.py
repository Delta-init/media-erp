"""
Scheduled email reports — Feature 6.
Manages recurring report schedules that email performance summaries to recipients.
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, Body
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, EmailStr

from app.database import get_db
from app.middleware.auth import get_current_user
from app.utils.response import error_response, success_response
from app.utils.timezone import utc_iso

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/email-reports", tags=["email-reports"])

VALID_FREQUENCIES = {"daily", "weekly", "monthly"}


# ── Schemas ───────────────────────────────────────────────────────────────────

class ScheduleCreate(BaseModel):
    name: str
    frequency: str = "weekly"   # "daily" | "weekly" | "monthly"
    day_of_week: Optional[int] = None    # 0=Mon, 6=Sun — for weekly
    day_of_month: Optional[int] = None  # 1-31 — for monthly
    send_time: str = "09:00"             # "HH:MM" IST wall-clock
    recipients: List[str]
    platforms: List[str] = []
    date_range_days: int = 7
    enabled: bool = True


class ScheduleUpdate(BaseModel):
    name: Optional[str] = None
    frequency: Optional[str] = None
    day_of_week: Optional[int] = None
    day_of_month: Optional[int] = None
    send_time: Optional[str] = None
    recipients: Optional[List[str]] = None
    platforms: Optional[List[str]] = None
    date_range_days: Optional[int] = None
    enabled: Optional[bool] = None


class TestEmailBody(BaseModel):
    recipient: str
    schedule_id: Optional[str] = None  # if provided, use that schedule's config


# ── Serializer ────────────────────────────────────────────────────────────────

def _ser(doc: dict) -> dict:
    def _dt(v):
        return utc_iso(v)
    return {
        "id": str(doc["_id"]),
        "name": doc.get("name", ""),
        "frequency": doc.get("frequency", "weekly"),
        "day_of_week": doc.get("day_of_week"),
        "day_of_month": doc.get("day_of_month"),
        "send_time": doc.get("send_time", "09:00"),
        "recipients": doc.get("recipients", []),
        "platforms": doc.get("platforms", []),
        "date_range_days": doc.get("date_range_days", 7),
        "enabled": doc.get("enabled", True),
        "last_sent_at": _dt(doc.get("last_sent_at")),
        "next_send_at": _dt(doc.get("next_send_at")),
        "created_at": _dt(doc.get("created_at")),
        "updated_at": _dt(doc.get("updated_at")),
    }


def _compute_next_send(frequency: str, send_time: str, day_of_week: Optional[int], day_of_month: Optional[int]) -> datetime:
    """
    Compute the next moment this schedule should fire.

    `send_time` ("HH:MM"), `day_of_week` and `day_of_month` are the user's
    **IST wall-clock** choices, so the whole calculation runs in IST. The value
    returned is the equivalent **UTC instant** (that is what we persist and what
    the scheduler compares `now` against).
    """
    from app.utils.timezone import IST

    now = datetime.now(IST)
    hour, minute = (int(x) for x in (send_time or "09:00").split(":"))

    if frequency == "daily":
        candidate = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
        if candidate <= now:
            candidate += timedelta(days=1)
        return candidate.astimezone(timezone.utc)

    if frequency == "weekly":
        dow = day_of_week if day_of_week is not None else 0  # default Monday
        candidate = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
        days_ahead = (dow - now.weekday()) % 7
        if days_ahead == 0 and candidate <= now:
            days_ahead = 7
        candidate += timedelta(days=days_ahead)
        return candidate.astimezone(timezone.utc)

    # monthly
    from calendar import monthrange
    dom = day_of_month if day_of_month is not None else 1

    def _month_candidate(year: int, month: int) -> datetime:
        _, last = monthrange(year, month)
        return now.replace(
            year=year, month=month, day=min(dom, last),
            hour=hour, minute=minute, second=0, microsecond=0,
        )

    candidate = _month_candidate(now.year, now.month)
    if candidate <= now:
        year, month = (now.year + 1, 1) if now.month == 12 else (now.year, now.month + 1)
        candidate = _month_candidate(year, month)
    return candidate.astimezone(timezone.utc)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/schedules", summary="List email report schedules")
async def list_schedules(
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = str(current_user["_id"])
    cursor = db["email_schedules"].find({"user_id": user_id}).sort("created_at", -1)
    items = [_ser(doc) async for doc in cursor]
    return success_response(data=items, message=f"{len(items)} schedule(s) found")


@router.post("/schedules", summary="Create a new email report schedule")
async def create_schedule(
    body: ScheduleCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = str(current_user["_id"])
    if body.frequency not in VALID_FREQUENCIES:
        return error_response(message=f"frequency must be one of {sorted(VALID_FREQUENCIES)}", status_code=422)
    if not body.recipients:
        return error_response(message="At least one recipient is required", status_code=422)

    now = datetime.now(timezone.utc)
    next_send = _compute_next_send(body.frequency, body.send_time, body.day_of_week, body.day_of_month)

    doc = {
        "user_id": user_id,
        "name": body.name,
        "frequency": body.frequency,
        "day_of_week": body.day_of_week,
        "day_of_month": body.day_of_month,
        "send_time": body.send_time,
        "recipients": body.recipients,
        "platforms": body.platforms,
        "date_range_days": body.date_range_days,
        "enabled": body.enabled,
        "last_sent_at": None,
        "next_send_at": next_send,
        "created_at": now,
        "updated_at": now,
    }
    result = await db["email_schedules"].insert_one(doc)
    doc["_id"] = result.inserted_id
    return success_response(data=_ser(doc), message="Email schedule created")


@router.patch("/schedules/{schedule_id}", summary="Update an email report schedule")
async def update_schedule(
    schedule_id: str,
    body: ScheduleUpdate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = str(current_user["_id"])
    try:
        oid = ObjectId(schedule_id)
    except InvalidId:
        return error_response(message="Invalid schedule ID", status_code=422)

    updates = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    if not updates:
        return error_response(message="No fields to update", status_code=422)

    # Recompute next_send if timing fields changed
    timing_keys = {"frequency", "day_of_week", "day_of_month", "send_time"}
    if timing_keys & set(updates.keys()):
        existing = await db["email_schedules"].find_one({"_id": oid, "user_id": user_id})
        if existing:
            freq = updates.get("frequency", existing.get("frequency", "weekly"))
            st   = updates.get("send_time", existing.get("send_time", "09:00"))
            dow  = updates.get("day_of_week", existing.get("day_of_week"))
            dom  = updates.get("day_of_month", existing.get("day_of_month"))
            updates["next_send_at"] = _compute_next_send(freq, st, dow, dom)

    updates["updated_at"] = datetime.now(timezone.utc)
    result = await db["email_schedules"].find_one_and_update(
        {"_id": oid, "user_id": user_id},
        {"$set": updates},
        return_document=True,
    )
    if not result:
        return error_response(message="Schedule not found or access denied", status_code=404)
    return success_response(data=_ser(result), message="Schedule updated")


@router.delete("/schedules/{schedule_id}", summary="Delete an email report schedule")
async def delete_schedule(
    schedule_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = str(current_user["_id"])
    try:
        oid = ObjectId(schedule_id)
    except InvalidId:
        return error_response(message="Invalid schedule ID", status_code=422)

    result = await db["email_schedules"].delete_one({"_id": oid, "user_id": user_id})
    if result.deleted_count == 0:
        return error_response(message="Schedule not found or access denied", status_code=404)
    return success_response(data={"id": schedule_id}, message="Schedule deleted")


@router.post("/send-now/{schedule_id}", summary="Send the report email immediately")
async def send_now(
    schedule_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    from app.services.email_report_service import send_schedule_report
    user_id = str(current_user["_id"])
    try:
        oid = ObjectId(schedule_id)
    except InvalidId:
        return error_response(message="Invalid schedule ID", status_code=422)

    schedule = await db["email_schedules"].find_one({"_id": oid, "user_id": user_id})
    if not schedule:
        return error_response(message="Schedule not found", status_code=404)

    result = await send_schedule_report(db, schedule)
    return success_response(data=result, message="Report sent")


@router.post("/test-email", summary="Send a test email to verify SMTP configuration")
async def test_email(
    body: TestEmailBody,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    from app.utils.email import send_email
    try:
        await send_email(
            body.recipient,
            "[mediaERP] Test Email",
            "<h2>Test email from mediaERP</h2><p>Your email configuration is working correctly.</p>",
            category="smtp_test",
        )
        return success_response(data={"sent_to": body.recipient}, message="Test email sent")
    except Exception as exc:
        return error_response(message=f"Email send failed: {exc}", status_code=500)
