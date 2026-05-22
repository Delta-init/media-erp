import csv
import io
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from fastapi.responses import StreamingResponse, Response
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.config import settings
from app.database import get_db
from app.middleware.auth import get_current_user
from app.schemas.report import CustomReportRequest, SaveReportRequest, ReportFilters
from app.services.report_service import (
    get_overview,
    get_campaigns,
    get_trend,
    run_custom,
    blend_platforms,
    get_saved_reports,
    create_saved_report,
    get_saved_report,
    delete_saved_report,
)
from app.utils.response import success_response, error_response

router = APIRouter(prefix="/api/v1/reports", tags=["reports"])


def _today_str() -> str:
    return datetime.now(timezone.utc).date().strftime("%Y-%m-%d")


def _thirty_days_ago_str() -> str:
    return (datetime.now(timezone.utc).date() - timedelta(days=30)).strftime("%Y-%m-%d")


# 4.1 — Overview KPIs
@router.get("/overview")
async def overview(
    date_from: str = Query(default=None),
    date_to: str = Query(default=None),
    platform: Optional[str] = Query(default=None),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    user_id = str(current_user["_id"])
    df = date_from or _thirty_days_ago_str()
    dt = date_to or _today_str()
    data = await get_overview(user_id, df, dt, platform, db)
    return success_response(data=data, message="Overview retrieved")


# 4.2 — Campaigns table
@router.get("/campaigns")
async def campaigns(
    platform: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=200),
    search: Optional[str] = Query(default=None),
    sort_by: str = Query(default="spend"),
    sort_dir: str = Query(default="desc"),
    date_from: Optional[str] = Query(default=None),
    date_to: Optional[str] = Query(default=None),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    user_id = str(current_user["_id"])
    data = await get_campaigns(user_id, platform, page, limit, search, sort_by, sort_dir, date_from, date_to, db)
    return success_response(data=data, message="Campaigns retrieved")


# 4.3 — Trend chart
@router.get("/trend")
async def trend(
    metric: str = Query(default="spend"),
    period: str = Query(default="daily"),
    platform: Optional[str] = Query(default=None),
    date_from: Optional[str] = Query(default=None),
    date_to: Optional[str] = Query(default=None),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    user_id = str(current_user["_id"])
    df = date_from or _thirty_days_ago_str()
    dt = date_to or _today_str()
    data = await get_trend(user_id, metric, period, platform, df, dt, db)
    return success_response(data=data, message="Trend retrieved")


# 4.4 — Custom report (POST)
@router.post("/custom")
async def custom_report(
    body: CustomReportRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    user_id = str(current_user["_id"])
    filters = body.filters.model_dump()
    data = await run_custom(user_id, body.metrics, body.dimensions, filters, db)
    data["chart_type"] = body.chart_type
    return success_response(data=data, message="Custom report generated")


# 4.4b — Data blend (cross-platform join on date axis)
class BlendSource(BaseModel):
    platform: str
    metrics: list[str] = []


class BlendRequest(BaseModel):
    sources:   list[BlendSource]
    date_from: Optional[str] = None
    date_to:   Optional[str] = None


@router.post("/blend")
async def blend_report(
    body: BlendRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Cross-platform data blend.
    Returns date-aligned series for every requested platform + metric combination.
    """
    user_id  = str(current_user["_id"])
    df = body.date_from or _thirty_days_ago_str()
    dt = body.date_to   or _today_str()
    sources = [s.model_dump() for s in body.sources]
    data = await blend_platforms(user_id, sources, df, dt, db)
    return success_response(data=data, message="Blend report generated")


# 4.5 — Saved reports
@router.get("/saved")
async def list_saved_reports(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    user_id = str(current_user["_id"])
    reports = await get_saved_reports(user_id, db)
    return success_response(data=reports, message="Saved reports retrieved")


@router.post("/saved", status_code=201)
async def save_report(
    body: SaveReportRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    user_id = str(current_user["_id"])
    filters = body.filters.model_dump()
    report = await create_saved_report(user_id, body.name, body.metrics, body.dimensions, filters, body.chart_type, db)
    return success_response(data=report, message="Report saved", status_code=201)


@router.get("/saved/{report_id}")
async def get_report(
    report_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    user_id = str(current_user["_id"])
    report = await get_saved_report(report_id, user_id, db)
    if report is None:
        return error_response(message="Report not found", status_code=404)
    return success_response(data=report, message="Report retrieved")


@router.delete("/saved/{report_id}", status_code=204)
async def remove_report(
    report_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    user_id = str(current_user["_id"])
    deleted = await delete_saved_report(report_id, user_id, db)
    if not deleted:
        return error_response(message="Report not found", status_code=404)
    return Response(status_code=204)


# 4.6 — CSV export
@router.get("/export")
async def export_report(
    metrics: Optional[str] = Query(default=None, description="Comma-separated metric names"),
    dimensions: Optional[str] = Query(default=None, description="Comma-separated dimension names"),
    platform: Optional[str] = Query(default=None),
    date_from: Optional[str] = Query(default=None),
    date_to: Optional[str] = Query(default=None),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    user_id = str(current_user["_id"])

    metrics_list = [m.strip() for m in metrics.split(",")] if metrics else []
    dimensions_list = [d.strip() for d in dimensions.split(",")] if dimensions else []

    filters = ReportFilters(
        platform=[platform] if platform else None,
        date_from=date_from,
        date_to=date_to,
    ).model_dump()

    result = await run_custom(user_id, metrics_list, dimensions_list, filters, db)
    data = result["data"]
    used_metrics = result["metrics"]
    used_dimensions = result["dimensions"]

    # Determine CSV columns: dimension cols first, then metric cols
    dim_cols = []
    for dim in used_dimensions:
        if dim == "campaign":
            dim_cols.extend(["campaign_id", "campaign_name"])
        else:
            dim_cols.append(dim)
    metric_cols = used_metrics

    all_cols = dim_cols + [c for c in metric_cols if c not in dim_cols]

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(all_cols)
    for row in data:
        writer.writerow([row.get(col, "") for col in all_cols])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=report.csv"},
    )


# ── Report sharing ─────────────────────────────────────────────────────────────

@router.post("/saved/{report_id}/share")
async def create_share_link(
    report_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Generate (or return existing) a public share token for a saved report.
    The share link is read-only and requires no authentication.
    """
    user_id = str(current_user["_id"])
    try:
        oid = ObjectId(report_id)
    except (InvalidId, Exception):
        return error_response("Invalid report ID", status_code=400)

    doc = await db["reports"].find_one({"_id": oid, "user_id": user_id})
    if doc is None:
        return error_response("Report not found", status_code=404)

    # Reuse existing token or generate a new one
    share_token = doc.get("share_token") or secrets.token_urlsafe(32)
    await db["reports"].update_one(
        {"_id": oid},
        {"$set": {"share_token": share_token, "share_enabled": True, "shared_at": datetime.now(timezone.utc)}},
    )

    share_url = f"{settings.frontend_url}/reports/shared/{share_token}"
    return success_response(
        data={"share_token": share_token, "share_url": share_url},
        message="Share link created",
    )


@router.delete("/saved/{report_id}/share")
async def revoke_share_link(
    report_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Revoke the public share link for a saved report."""
    user_id = str(current_user["_id"])
    try:
        oid = ObjectId(report_id)
    except (InvalidId, Exception):
        return error_response("Invalid report ID", status_code=400)

    result = await db["reports"].update_one(
        {"_id": oid, "user_id": user_id},
        {"$unset": {"share_token": "", "shared_at": ""}, "$set": {"share_enabled": False}},
    )
    if result.matched_count == 0:
        return error_response("Report not found", status_code=404)
    return success_response(data=None, message="Share link revoked")


@router.get("/shared/{share_token}")
async def get_shared_report(
    share_token: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Public endpoint — no authentication required.
    Returns the saved report configuration + its data for read-only viewing.
    """
    doc = await db["reports"].find_one(
        {"share_token": share_token, "share_enabled": True}
    )
    if doc is None:
        return error_response("Report not found or sharing has been disabled", status_code=404)

    user_id = str(doc["user_id"]) if isinstance(doc.get("user_id"), ObjectId) else doc.get("user_id", "")
    metrics    = doc.get("metrics", [])
    dimensions = doc.get("dimensions", [])
    filters    = doc.get("filters", {})

    report_data = await run_custom(user_id, metrics, dimensions, filters, db)
    report_data["chart_type"] = doc.get("chart_type", "bar")

    from app.services.report_service import _serialize
    return success_response(
        data={
            "report": _serialize(doc),
            "data":   report_data,
        },
        message="Shared report retrieved",
    )
