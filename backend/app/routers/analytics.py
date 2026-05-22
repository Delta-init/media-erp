"""
Analytics endpoints — Sprint 3.

  GET /api/v1/analytics/attribution   — attribution modeling
  GET /api/v1/analytics/anomalies     — anomaly detection
"""
from typing import Optional

from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.database import get_db
from app.middleware.auth import get_current_user
from app.services.attribution_service import compute_attribution
from app.services.anomaly_service import detect_anomalies
from app.utils.response import success_response, error_response

router = APIRouter(prefix="/api/v1/analytics", tags=["analytics"])


@router.get("/attribution")
async def attribution(
    date_from: Optional[str]  = Query(default=None),
    date_to:   Optional[str]  = Query(default=None),
    model:     str            = Query(default="linear",
                                      description="first_touch | last_touch | linear | time_decay"),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Cross-channel attribution report.

    Distributes total conversions and revenue across connected platforms
    using the chosen attribution model. Spend is used as the touchpoint proxy.
    """
    from datetime import datetime, timezone, timedelta

    def _today():
        return datetime.now(timezone.utc).date().strftime("%Y-%m-%d")

    def _thirty_ago():
        return (datetime.now(timezone.utc).date() - timedelta(days=30)).strftime("%Y-%m-%d")

    user_id = str(current_user["_id"])
    df = date_from or _thirty_ago()
    dt = date_to   or _today()

    data = await compute_attribution(user_id, df, dt, model, db)
    return success_response(data=data, message="Attribution computed")


@router.get("/anomalies")
async def anomalies(
    date_from: Optional[str]  = Query(default=None),
    date_to:   Optional[str]  = Query(default=None),
    metrics:   Optional[str]  = Query(default=None,
                                      description="Comma-separated metric names, e.g. spend,clicks"),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Anomaly detection via rolling z-score (14-day baseline window).
    Returns flagged dates where a metric deviated > 2σ from its rolling mean.
    """
    from datetime import datetime, timezone, timedelta

    def _today():
        return datetime.now(timezone.utc).date().strftime("%Y-%m-%d")

    def _thirty_ago():
        return (datetime.now(timezone.utc).date() - timedelta(days=30)).strftime("%Y-%m-%d")

    user_id     = str(current_user["_id"])
    df          = date_from or _thirty_ago()
    dt          = date_to   or _today()
    metric_list = [m.strip() for m in metrics.split(",")] if metrics else []

    data = await detect_anomalies(user_id, df, dt, metric_list, db)
    return success_response(data=data, message="Anomaly detection complete")
