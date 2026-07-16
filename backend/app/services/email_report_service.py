"""
Email report scheduler daemon — Feature 6.
Polls every 60 seconds, fires due email_schedules, updates next_send_at.
"""
import asyncio
import logging
from datetime import datetime, timedelta, timezone

from motor.motor_asyncio import AsyncIOMotorDatabase
from app.utils.timezone import utc_iso

logger = logging.getLogger(__name__)

_POLL_INTERVAL_SEC = 60


async def _fetch_report_data(db: AsyncIOMotorDatabase, schedule: dict) -> list[dict]:
    """Pull marketing_data rows for the schedule's configured time window + platforms."""
    user_id = schedule["user_id"]
    date_range_days = schedule.get("date_range_days", 7)
    platforms = schedule.get("platforms", [])

    now = datetime.now(timezone.utc)
    date_to = now.strftime("%Y-%m-%d")
    date_from = (now - timedelta(days=date_range_days)).strftime("%Y-%m-%d")

    match: dict = {
        "user_id": user_id,
        "date": {"$gte": date_from, "$lte": date_to},
    }
    if platforms:
        match["platform"] = {"$in": platforms}

    cursor = db["marketing_data"].find(match).sort("date", -1).limit(200)
    return [doc async for doc in cursor]


async def send_schedule_report(db: AsyncIOMotorDatabase, schedule: dict) -> dict:
    """Send one email report for the given schedule document. Returns result summary."""
    from app.services.email_service import send_report_email
    from app.routers.email_reports import _compute_next_send

    rows = await _fetch_report_data(db, schedule)
    recipients = schedule.get("recipients", [])
    name = schedule.get("name", "Performance Report")

    now = datetime.now(timezone.utc)
    date_range_days = schedule.get("date_range_days", 7)
    date_to = now.strftime("%Y-%m-%d")
    date_from = (now - timedelta(days=date_range_days)).strftime("%Y-%m-%d")

    # Compute when to fire next
    next_send = _compute_next_send(
        schedule.get("frequency", "weekly"),
        schedule.get("send_time", "09:00"),
        schedule.get("day_of_week"),
        schedule.get("day_of_month"),
    )

    try:
        await send_report_email(recipients, name, date_from, date_to, rows)
        status = "sent"
        error = None
    except Exception as exc:
        logger.error("Failed to send report '%s': %s", name, exc)
        status = "error"
        error = str(exc)

    # Update schedule timestamps
    await db["email_schedules"].update_one(
        {"_id": schedule["_id"]},
        {"$set": {"last_sent_at": now, "next_send_at": next_send, "updated_at": now}},
    )

    return {
        "status": status,
        "recipients": recipients,
        "rows_sent": len(rows),
        "date_from": date_from,
        "date_to": date_to,
        "next_send_at": utc_iso(next_send),
        "error": error,
    }


async def _scheduler_loop(db: AsyncIOMotorDatabase):
    """Fire all due email schedules every minute."""
    while True:
        try:
            now = datetime.now(timezone.utc)
            cursor = db["email_schedules"].find({
                "enabled": True,
                "next_send_at": {"$lte": now},
            })
            async for schedule in cursor:
                try:
                    result = await send_schedule_report(db, schedule)
                    logger.info(
                        "Email report '%s' sent: %s rows to %d recipient(s)",
                        schedule.get("name"),
                        result.get("rows_sent"),
                        len(result.get("recipients", [])),
                    )
                except Exception as exc:
                    logger.error("Email report error for schedule %s: %s", schedule["_id"], exc)
        except Exception as exc:
            logger.error("Email report scheduler loop error: %s", exc)
        await asyncio.sleep(_POLL_INTERVAL_SEC)


def start_email_scheduler():
    """Entry-point called from main.py lifespan — runs in a daemon thread."""
    import asyncio as _asyncio

    async def _run():
        from motor.motor_asyncio import AsyncIOMotorClient
        from app.config import settings
        client = AsyncIOMotorClient(settings.mongodb_url)
        db = client[settings.mongodb_db_name]
        await _scheduler_loop(db)

    try:
        loop = _asyncio.new_event_loop()
        loop.run_until_complete(_run())
    except Exception as exc:
        logger.error("Email scheduler thread crashed: %s", exc)
