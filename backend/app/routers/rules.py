"""
Automated rules & alerts — Feature 9.
Rules evaluate campaign metrics and trigger alerts, pauses, or email notifications
when thresholds are crossed.
"""
import logging
from datetime import datetime, timezone
from typing import List, Optional

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, field_validator

from app.database import get_db
from app.middleware.auth import get_current_user
from app.utils.response import error_response, success_response

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/rules", tags=["rules"])

VALID_METRICS = {"spend", "impressions", "clicks", "ctr", "cpa", "roas", "cpm", "reach", "conversions"}
VALID_OPERATORS = {"gt", "lt", "gte", "lte", "eq"}
VALID_ACTIONS = {"alert", "pause_campaign", "email"}


# ── Schemas ───────────────────────────────────────────────────────────────────

class RuleCreate(BaseModel):
    name: str
    platform: str
    connector_id: str
    campaign_id: Optional[str] = None   # null = all campaigns on connector
    metric: str
    operator: str
    threshold: float
    action: str = "alert"
    email_recipients: List[str] = []
    cooldown_minutes: int = 60
    enabled: bool = True

    @field_validator("metric")
    @classmethod
    def validate_metric(cls, v):
        if v not in VALID_METRICS:
            raise ValueError(f"metric must be one of {sorted(VALID_METRICS)}")
        return v

    @field_validator("operator")
    @classmethod
    def validate_operator(cls, v):
        if v not in VALID_OPERATORS:
            raise ValueError(f"operator must be one of {sorted(VALID_OPERATORS)}")
        return v

    @field_validator("action")
    @classmethod
    def validate_action(cls, v):
        if v not in VALID_ACTIONS:
            raise ValueError(f"action must be one of {sorted(VALID_ACTIONS)}")
        return v


class RuleUpdate(BaseModel):
    name: Optional[str] = None
    threshold: Optional[float] = None
    operator: Optional[str] = None
    metric: Optional[str] = None
    action: Optional[str] = None
    email_recipients: Optional[List[str]] = None
    cooldown_minutes: Optional[int] = None
    enabled: Optional[bool] = None


# ── Serializers ───────────────────────────────────────────────────────────────

def _ser(doc: dict) -> dict:
    def _dt(v):
        return v.isoformat() if isinstance(v, datetime) else v

    return {
        "id": str(doc["_id"]),
        "name": doc.get("name", ""),
        "platform": doc.get("platform", ""),
        "connector_id": doc.get("connector_id", ""),
        "campaign_id": doc.get("campaign_id"),
        "metric": doc.get("metric", ""),
        "operator": doc.get("operator", ""),
        "threshold": doc.get("threshold", 0),
        "action": doc.get("action", "alert"),
        "email_recipients": doc.get("email_recipients", []),
        "cooldown_minutes": doc.get("cooldown_minutes", 60),
        "enabled": doc.get("enabled", True),
        "last_triggered_at": _dt(doc.get("last_triggered_at")),
        "triggered_count": doc.get("triggered_count", 0),
        "created_at": _dt(doc.get("created_at")),
        "updated_at": _dt(doc.get("updated_at")),
    }


def _ser_trigger(doc: dict) -> dict:
    def _dt(v):
        return v.isoformat() if isinstance(v, datetime) else v

    return {
        "id": str(doc["_id"]),
        "rule_id": doc.get("rule_id", ""),
        "rule_name": doc.get("rule_name", ""),
        "campaign_id": doc.get("campaign_id", ""),
        "campaign_name": doc.get("campaign_name", ""),
        "platform": doc.get("platform", ""),
        "metric": doc.get("metric", ""),
        "operator": doc.get("operator", ""),
        "threshold": doc.get("threshold", 0),
        "actual_value": doc.get("actual_value", 0),
        "action_taken": doc.get("action_taken", ""),
        "action_result": doc.get("action_result"),
        "triggered_at": _dt(doc.get("triggered_at")),
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("", summary="List all rules for the current user")
async def list_rules(
    enabled_only: bool = Query(False),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = str(current_user["_id"])
    query: dict = {"user_id": user_id}
    if enabled_only:
        query["enabled"] = True
    cursor = db["rules"].find(query).sort("created_at", -1)
    rules = [_ser(doc) async for doc in cursor]
    return success_response(data=rules, message=f"{len(rules)} rule(s) found")


@router.post("", summary="Create a new rule")
async def create_rule(
    body: RuleCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = str(current_user["_id"])
    now = datetime.now(timezone.utc)
    doc = {
        "user_id": user_id,
        "name": body.name,
        "platform": body.platform,
        "connector_id": body.connector_id,
        "campaign_id": body.campaign_id or None,
        "metric": body.metric,
        "operator": body.operator,
        "threshold": body.threshold,
        "action": body.action,
        "email_recipients": body.email_recipients,
        "cooldown_minutes": body.cooldown_minutes,
        "enabled": body.enabled,
        "last_triggered_at": None,
        "triggered_count": 0,
        "created_at": now,
        "updated_at": now,
    }
    result = await db["rules"].insert_one(doc)
    doc["_id"] = result.inserted_id
    return success_response(data=_ser(doc), message="Rule created")


@router.patch("/{rule_id}", summary="Update a rule")
async def update_rule(
    rule_id: str,
    body: RuleUpdate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = str(current_user["_id"])
    try:
        oid = ObjectId(rule_id)
    except InvalidId:
        return error_response(message="Invalid rule ID", status_code=422)

    updates = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    if not updates:
        return error_response(message="No fields to update", status_code=422)

    if "metric" in updates and updates["metric"] not in VALID_METRICS:
        return error_response(message=f"Invalid metric", status_code=422)
    if "operator" in updates and updates["operator"] not in VALID_OPERATORS:
        return error_response(message=f"Invalid operator", status_code=422)
    if "action" in updates and updates["action"] not in VALID_ACTIONS:
        return error_response(message=f"Invalid action", status_code=422)

    updates["updated_at"] = datetime.now(timezone.utc)
    result = await db["rules"].find_one_and_update(
        {"_id": oid, "user_id": user_id},
        {"$set": updates},
        return_document=True,
    )
    if not result:
        return error_response(message="Rule not found or access denied", status_code=404)
    return success_response(data=_ser(result), message="Rule updated")


@router.delete("/{rule_id}", summary="Delete a rule")
async def delete_rule(
    rule_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = str(current_user["_id"])
    try:
        oid = ObjectId(rule_id)
    except InvalidId:
        return error_response(message="Invalid rule ID", status_code=422)

    result = await db["rules"].delete_one({"_id": oid, "user_id": user_id})
    if result.deleted_count == 0:
        return error_response(message="Rule not found or access denied", status_code=404)
    return success_response(data={"id": rule_id}, message="Rule deleted")


@router.get("/history", summary="Get alert trigger history")
async def get_history(
    limit: int = Query(50, ge=1, le=200),
    rule_id: Optional[str] = Query(None),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = str(current_user["_id"])
    query: dict = {"user_id": user_id}
    if rule_id:
        query["rule_id"] = rule_id

    cursor = db["rule_triggers"].find(query).sort("triggered_at", -1).limit(limit)
    history = [_ser_trigger(doc) async for doc in cursor]
    return success_response(data=history, message=f"{len(history)} trigger(s) found")


@router.post("/evaluate", summary="Manually trigger rule evaluation for testing")
async def evaluate_rules(
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Run rule evaluation immediately for the current user."""
    from app.services.rules_service import evaluate_user_rules
    user_id = str(current_user["_id"])
    triggered = await evaluate_user_rules(db, user_id)
    return success_response(
        data={"triggered_count": triggered},
        message=f"Evaluation complete — {triggered} rule(s) triggered",
    )
