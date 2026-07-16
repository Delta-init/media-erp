"""
Budget goals and pacing alerts — Phase 1.
Manage per-campaign budget goals, alert thresholds, and pacing calculations.
"""
import logging
from calendar import monthrange
from datetime import date, datetime, timezone
from typing import Optional

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel

from app.database import get_db
from app.middleware.auth import get_current_user
from app.utils.response import error_response, success_response
from app.utils.timezone import utc_iso

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/budget", tags=["budget"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class BudgetGoalCreate(BaseModel):
    campaign_id: str
    campaign_name: str
    platform: str
    connector_id: str
    total_budget: float
    alert_threshold_pct: int = 80
    period: str = "monthly"  # "monthly" or "custom"
    period_start: Optional[str] = None  # "YYYY-MM-DD"
    period_end: Optional[str] = None    # "YYYY-MM-DD"


# ── Helpers ───────────────────────────────────────────────────────────────────

def _current_month_range() -> tuple[str, str]:
    """Return (start, end) ISO date strings for the current calendar month."""
    today = date.today()
    _, last_day = monthrange(today.year, today.month)
    start = date(today.year, today.month, 1).isoformat()
    end = date(today.year, today.month, last_day).isoformat()
    return start, end


def _days_in_period(start_str: str, end_str: str) -> int:
    """Return the total number of days in the period (inclusive)."""
    start = date.fromisoformat(start_str)
    end = date.fromisoformat(end_str)
    delta = (end - start).days + 1
    return max(delta, 1)


def _days_elapsed(start_str: str) -> int:
    """Return the number of days elapsed since period start (min 1)."""
    start = date.fromisoformat(start_str)
    today = date.today()
    elapsed = (today - start).days + 1
    return max(elapsed, 1)


async def _sum_spend(
    db: AsyncIOMotorDatabase,
    user_id: str,
    campaign_id: str,
    period_start: str,
    period_end: str,
) -> float:
    """Sum metrics.spend for a campaign in the given date range."""
    pipeline = [
        {
            "$match": {
                "user_id": user_id,
                "campaign_id": campaign_id,
                "date": {"$gte": period_start, "$lte": period_end},
            }
        },
        {
            "$group": {
                "_id": None,
                "total_spend": {"$sum": "$metrics.spend"},
            }
        },
    ]
    result = await db["marketing_data"].aggregate(pipeline).to_list(1)
    if result:
        return round(result[0].get("total_spend", 0.0), 2)
    return 0.0


def _serialize_goal(doc: dict) -> dict:
    """Convert a MongoDB goal document to a JSON-serialisable dict."""
    return {
        "id": str(doc["_id"]),
        "campaign_id": doc.get("campaign_id", ""),
        "campaign_name": doc.get("campaign_name", ""),
        "platform": doc.get("platform", ""),
        "connector_id": doc.get("connector_id", ""),
        "total_budget": doc.get("total_budget", 0.0),
        "alert_threshold_pct": doc.get("alert_threshold_pct", 80),
        "period": doc.get("period", "monthly"),
        "period_start": doc.get("period_start"),
        "period_end": doc.get("period_end"),
        "created_at": utc_iso(doc.get("created_at")),
        "updated_at": utc_iso(doc.get("updated_at")),
    }


def _resolve_period(goal: dict) -> tuple[str, str]:
    """Return (period_start, period_end) for a goal based on its period type."""
    if goal.get("period") == "custom":
        return goal.get("period_start") or "", goal.get("period_end") or ""
    # monthly — always use current month
    return _current_month_range()


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/goals", summary="List all budget goals for the current user")
async def list_goals(
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = str(current_user["_id"])
    cursor = db["budget_goals"].find({"user_id": user_id}).sort("created_at", -1)
    goals = [_serialize_goal(doc) async for doc in cursor]
    return success_response(data=goals, message="Budget goals retrieved")


@router.post("/goals", summary="Create a new budget goal")
async def create_goal(
    body: BudgetGoalCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = str(current_user["_id"])

    if body.total_budget <= 0:
        return error_response(message="total_budget must be positive", status_code=422)
    if body.period not in ("monthly", "custom"):
        return error_response(message="period must be 'monthly' or 'custom'", status_code=422)
    if body.period == "custom" and not (body.period_start and body.period_end):
        return error_response(
            message="period_start and period_end are required for custom periods",
            status_code=422,
        )
    if not (1 <= body.alert_threshold_pct <= 100):
        return error_response(message="alert_threshold_pct must be between 1 and 100", status_code=422)

    now = datetime.now(timezone.utc)
    doc = {
        "user_id": user_id,
        "campaign_id": body.campaign_id,
        "campaign_name": body.campaign_name,
        "platform": body.platform,
        "connector_id": body.connector_id,
        "total_budget": body.total_budget,
        "alert_threshold_pct": body.alert_threshold_pct,
        "period": body.period,
        "period_start": body.period_start,
        "period_end": body.period_end,
        "created_at": now,
        "updated_at": now,
    }

    result = await db["budget_goals"].insert_one(doc)
    doc["_id"] = result.inserted_id

    return success_response(data=_serialize_goal(doc), message="Budget goal created")


@router.delete("/goals/{goal_id}", summary="Delete a budget goal")
async def delete_goal(
    goal_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = str(current_user["_id"])

    try:
        oid = ObjectId(goal_id)
    except InvalidId:
        return error_response(message="Invalid goal ID", status_code=422)

    result = await db["budget_goals"].delete_one({"_id": oid, "user_id": user_id})
    if result.deleted_count == 0:
        return error_response(message="Budget goal not found or access denied", status_code=404)

    return success_response(data={"id": goal_id}, message="Budget goal deleted")


@router.get("/alerts", summary="Get campaigns where spend has reached the alert threshold")
async def get_alerts(
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Return budget goals where actual spend >= alert_threshold_pct of total_budget.
    """
    user_id = str(current_user["_id"])

    cursor = db["budget_goals"].find({"user_id": user_id})
    alerts = []

    async for goal in cursor:
        period_start, period_end = _resolve_period(goal)
        if not period_start or not period_end:
            continue

        actual_spend = await _sum_spend(
            db, user_id, goal["campaign_id"], period_start, period_end
        )

        total_budget = goal.get("total_budget", 0.0)
        threshold = goal.get("alert_threshold_pct", 80)

        if total_budget <= 0:
            continue

        spend_pct = round((actual_spend / total_budget) * 100, 2)

        if spend_pct >= threshold:
            serialized = _serialize_goal(goal)
            serialized["actual_spend"] = actual_spend
            serialized["spend_pct"] = spend_pct
            serialized["period_start_resolved"] = period_start
            serialized["period_end_resolved"] = period_end
            alerts.append(serialized)

    return success_response(data=alerts, message=f"{len(alerts)} budget alert(s) found")


@router.get("/pacing", summary="Get pacing status for all budget goals this period")
async def get_pacing(
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    For each budget goal, calculate whether the campaign is on-track, overpacing,
    underpacing, or has exceeded its budget.
    """
    user_id = str(current_user["_id"])

    cursor = db["budget_goals"].find({"user_id": user_id})
    pacing_results = []

    async for goal in cursor:
        period_start, period_end = _resolve_period(goal)
        if not period_start or not period_end:
            continue

        actual_spend = await _sum_spend(
            db, user_id, goal["campaign_id"], period_start, period_end
        )

        total_budget = goal.get("total_budget", 0.0)
        days_in_period = _days_in_period(period_start, period_end)
        days_elapsed = _days_elapsed(period_start)
        # Cap elapsed days to period length
        days_elapsed = min(days_elapsed, days_in_period)

        expected_spend = round((days_elapsed / days_in_period) * total_budget, 2)

        if total_budget <= 0:
            status = "unknown"
            pacing_ratio = None
        elif actual_spend >= total_budget:
            status = "exceeded"
            pacing_ratio = round(actual_spend / total_budget, 4) if total_budget > 0 else None
        elif expected_spend <= 0:
            status = "underpacing"
            pacing_ratio = 0.0
        else:
            pacing_ratio = round(actual_spend / expected_spend, 4)
            if pacing_ratio > 1.1:
                status = "overpacing"
            elif pacing_ratio < 0.9:
                status = "underpacing"
            else:
                status = "on_track"

        serialized = _serialize_goal(goal)
        serialized.update({
            "actual_spend": actual_spend,
            "expected_spend": expected_spend,
            "days_in_period": days_in_period,
            "days_elapsed": days_elapsed,
            "pacing_ratio": pacing_ratio,
            "pacing_status": status,
            "period_start_resolved": period_start,
            "period_end_resolved": period_end,
        })
        pacing_results.append(serialized)

    return success_response(data=pacing_results, message="Pacing data retrieved")
