"""
KPI targets — Feature 16.
Manage per-user KPI targets for marketing metrics.
"""
import logging
from datetime import datetime, timezone
from typing import Literal, Optional

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, Response
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel

from app.database import get_db
from app.middleware.auth import get_current_user
from app.utils.response import error_response, success_response

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/kpi-targets", tags=["kpi-targets"])


# ── Schemas ───────────────────────────────────────────────────────────────────

VALID_METRICS = {
    "spend", "impressions", "clicks", "conversions",
    "revenue", "ctr", "roas", "cpm", "reach",
}

VALID_PERIODS = {"daily", "weekly", "monthly"}


class KpiTargetCreate(BaseModel):
    metric: str
    target_value: float
    period: str = "monthly"
    platform: Optional[str] = None
    label: Optional[str] = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _serialize_target(doc: dict) -> dict:
    """Convert a MongoDB kpi_targets document to a JSON-serialisable dict."""
    created_at = doc.get("created_at")
    updated_at = doc.get("updated_at")
    return {
        "id": str(doc["_id"]),
        "metric": doc.get("metric", ""),
        "target_value": doc.get("target_value", 0.0),
        "period": doc.get("period", "monthly"),
        "platform": doc.get("platform"),
        "label": doc.get("label"),
        "created_at": created_at.isoformat() if isinstance(created_at, datetime) else created_at,
        "updated_at": updated_at.isoformat() if isinstance(updated_at, datetime) else updated_at,
    }


def _validate_body(body: KpiTargetCreate):
    """Return an error message string if the body is invalid, else None."""
    if body.metric not in VALID_METRICS:
        return f"metric must be one of: {', '.join(sorted(VALID_METRICS))}"
    if body.period not in VALID_PERIODS:
        return f"period must be one of: {', '.join(sorted(VALID_PERIODS))}"
    if body.target_value < 0:
        return "target_value must be non-negative"
    return None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("", summary="List all KPI targets for the current user")
async def list_kpi_targets(
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = str(current_user["_id"])
    cursor = db["kpi_targets"].find({"user_id": user_id}).sort("created_at", -1)
    targets = [_serialize_target(doc) async for doc in cursor]
    return success_response(data=targets, message="KPI targets retrieved")


@router.post("", status_code=201, summary="Create a new KPI target")
async def create_kpi_target(
    body: KpiTargetCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = str(current_user["_id"])

    err = _validate_body(body)
    if err:
        return error_response(message=err, status_code=422)

    now = datetime.now(timezone.utc)
    doc = {
        "user_id": user_id,
        "metric": body.metric,
        "target_value": body.target_value,
        "period": body.period,
        "platform": body.platform,
        "label": body.label,
        "created_at": now,
        "updated_at": now,
    }

    result = await db["kpi_targets"].insert_one(doc)
    doc["_id"] = result.inserted_id

    return success_response(data=_serialize_target(doc), message="KPI target created")


@router.put("/{target_id}", summary="Update an existing KPI target")
async def update_kpi_target(
    target_id: str,
    body: KpiTargetCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = str(current_user["_id"])

    try:
        oid = ObjectId(target_id)
    except InvalidId:
        return error_response(message="Invalid target ID", status_code=422)

    err = _validate_body(body)
    if err:
        return error_response(message=err, status_code=422)

    existing = await db["kpi_targets"].find_one({"_id": oid, "user_id": user_id})
    if not existing:
        return error_response(message="KPI target not found or access denied", status_code=404)

    now = datetime.now(timezone.utc)
    update_fields = {
        "metric": body.metric,
        "target_value": body.target_value,
        "period": body.period,
        "platform": body.platform,
        "label": body.label,
        "updated_at": now,
    }

    await db["kpi_targets"].update_one({"_id": oid}, {"$set": update_fields})
    updated = {**existing, **update_fields}

    return success_response(data=_serialize_target(updated), message="KPI target updated")


@router.delete("/{target_id}", status_code=204, summary="Delete a KPI target")
async def delete_kpi_target(
    target_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = str(current_user["_id"])

    try:
        oid = ObjectId(target_id)
    except InvalidId:
        return error_response(message="Invalid target ID", status_code=422)

    result = await db["kpi_targets"].delete_one({"_id": oid, "user_id": user_id})
    if result.deleted_count == 0:
        return error_response(message="KPI target not found or access denied", status_code=404)

    return Response(status_code=204)
