"""
Custom metric formula CRUD — Sprint 3.

  GET    /api/v1/custom-metrics           — list user's formulas
  POST   /api/v1/custom-metrics           — create a new formula
  DELETE /api/v1/custom-metrics/{id}      — delete a formula
  POST   /api/v1/custom-metrics/preview   — validate + evaluate with sample data
"""
from typing import Optional

from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel

from app.database import get_db
from app.middleware.auth import get_current_user
from app.services.formula_service import (
    list_custom_metrics,
    create_custom_metric,
    delete_custom_metric,
    preview_formula,
)
from app.utils.response import success_response, error_response

router = APIRouter(prefix="/api/v1/custom-metrics", tags=["custom-metrics"])


class CreateMetricBody(BaseModel):
    name:    str  # machine-readable ID, e.g. "cost_per_conv"
    label:   str  # display label, e.g. "Cost per Conversion"
    formula: str  # e.g. "spend / conversions"


class PreviewBody(BaseModel):
    formula:       str
    sample_values: Optional[dict] = None  # {metric_name: value}


@router.get("")
async def list_metrics(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    user_id = str(current_user["_id"])
    metrics = await list_custom_metrics(user_id, db)
    return success_response(data=metrics, message="Custom metrics retrieved")


@router.post("", status_code=201)
async def create_metric(
    body: CreateMetricBody,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    user_id = str(current_user["_id"])
    metric, err = await create_custom_metric(
        user_id, body.name, body.label, body.formula, db
    )
    if err:
        return error_response(err, status_code=400)
    return success_response(data=metric, message="Custom metric created", status_code=201)


@router.delete("/{metric_id}", status_code=204)
async def remove_metric(
    metric_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    from fastapi.responses import Response
    user_id = str(current_user["_id"])
    deleted = await delete_custom_metric(metric_id, user_id, db)
    if not deleted:
        return error_response("Metric not found", status_code=404)
    return Response(status_code=204)


@router.post("/preview")
async def preview_metric(
    body: PreviewBody,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    result = await preview_formula(body.formula, body.sample_values, db)
    return success_response(data=result, message="Preview computed")
