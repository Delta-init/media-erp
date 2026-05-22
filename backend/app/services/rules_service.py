"""
Background rule evaluation engine — Feature 9.
Polls every 5 minutes, evaluates enabled rules against the latest marketing_data,
and fires configured actions (alert log, campaign pause, email notification).
"""
import asyncio
import logging
import time
from datetime import datetime, timedelta, timezone

from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)

_EVAL_INTERVAL_SEC = 300  # 5 minutes

OPERATOR_FNS = {
    "gt":  lambda actual, threshold: actual > threshold,
    "lt":  lambda actual, threshold: actual < threshold,
    "gte": lambda actual, threshold: actual >= threshold,
    "lte": lambda actual, threshold: actual <= threshold,
    "eq":  lambda actual, threshold: actual == threshold,
}


async def _get_metric_value(
    db: AsyncIOMotorDatabase,
    user_id: str,
    connector_id: str,
    campaign_id: str | None,
    metric: str,
) -> list[dict]:
    """
    Return a list of {campaign_id, campaign_name, value} for the latest day
    of marketing_data matching the connector / campaign filter.
    Aggregates over the most recent date available.
    """
    match: dict = {"user_id": user_id, "connector_id": connector_id}
    if campaign_id:
        match["campaign_id"] = campaign_id

    # Find the most recent date that has data
    latest = await db["marketing_data"].find_one(
        match, sort=[("date", -1)], projection={"date": 1}
    )
    if not latest:
        return []
    latest_date = latest["date"]

    match["date"] = latest_date

    # Map metric name to the nested field in the doc
    field_map = {
        "spend":       "metrics.spend",
        "impressions": "metrics.impressions",
        "clicks":      "metrics.clicks",
        "ctr":         "metrics.ctr",
        "cpa":         "metrics.cpa",
        "roas":        "metrics.roas",
        "cpm":         "metrics.cpm",
        "reach":       "metrics.reach",
        "conversions": "metrics.conversions",
    }
    field = field_map.get(metric, f"metrics.{metric}")

    pipeline = [
        {"$match": match},
        {
            "$group": {
                "_id": {
                    "campaign_id":   "$campaign_id",
                    "campaign_name": "$campaign_name",
                },
                "value": {"$sum": f"${field}"},
            }
        },
    ]
    results = await db["marketing_data"].aggregate(pipeline).to_list(None)
    return [
        {
            "campaign_id":   r["_id"]["campaign_id"],
            "campaign_name": r["_id"].get("campaign_name", ""),
            "value":         round(r.get("value", 0), 4),
        }
        for r in results
    ]


async def _take_action(
    db: AsyncIOMotorDatabase,
    rule: dict,
    campaign_id: str,
    campaign_name: str,
    actual_value: float,
) -> str:
    """Execute the configured action and return a result description."""
    action = rule.get("action", "alert")

    if action == "alert":
        # Just logging — the trigger record itself is the alert
        return "alert_logged"

    if action == "pause_campaign":
        # Import lazily to avoid circular deps
        try:
            from app.routers.campaigns_write import _pause_or_resume  # type: ignore
            result = await _pause_or_resume(db, rule["user_id"], campaign_id, "pause")
            return f"campaign_paused: {result}"
        except Exception as exc:
            logger.warning("pause_campaign action failed for %s: %s", campaign_id, exc)
            return f"pause_failed: {exc}"

    if action == "email":
        recipients = rule.get("email_recipients", [])
        if recipients:
            try:
                from app.services.email_service import send_rule_alert_email
                op_label = {"gt": ">", "lt": "<", "gte": ">=", "lte": "<=", "eq": "=="}.get(
                    rule["operator"], rule["operator"]
                )
                subject = f"[mediaERP Alert] {rule['name']}"
                body = (
                    f"Rule '{rule['name']}' triggered.\n\n"
                    f"Campaign: {campaign_name}\n"
                    f"Metric: {rule['metric']} {op_label} {rule['threshold']}\n"
                    f"Actual value: {actual_value}\n"
                    f"Platform: {rule['platform']}\n"
                    f"Time: {datetime.now(timezone.utc).isoformat()}"
                )
                await send_rule_alert_email(recipients, subject, body)
                return f"email_sent_to_{len(recipients)}_recipients"
            except Exception as exc:
                logger.warning("email action failed for rule %s: %s", rule["_id"], exc)
                return f"email_failed: {exc}"
        return "no_recipients_configured"

    return f"unknown_action_{action}"


async def evaluate_user_rules(db: AsyncIOMotorDatabase, user_id: str) -> int:
    """
    Evaluate all enabled rules for a single user.
    Returns the number of rules that triggered.
    """
    now = datetime.now(timezone.utc)
    triggered_count = 0

    cursor = db["rules"].find({"user_id": user_id, "enabled": True})
    async for rule in cursor:
        cooldown_min = rule.get("cooldown_minutes", 60)
        last_triggered = rule.get("last_triggered_at")

        # Respect cooldown
        if last_triggered and isinstance(last_triggered, datetime):
            if last_triggered.tzinfo is None:
                last_triggered = last_triggered.replace(tzinfo=timezone.utc)
            if (now - last_triggered) < timedelta(minutes=cooldown_min):
                continue

        # Get metric values for matching campaigns
        campaigns = await _get_metric_value(
            db,
            user_id,
            rule["connector_id"],
            rule.get("campaign_id"),
            rule["metric"],
        )

        op_fn = OPERATOR_FNS.get(rule["operator"])
        if not op_fn:
            continue

        for camp in campaigns:
            actual = camp["value"]
            if not op_fn(actual, rule["threshold"]):
                continue

            # Rule fires — log trigger
            triggered_count += 1
            action_result = await _take_action(
                db, rule, camp["campaign_id"], camp["campaign_name"], actual
            )

            trigger_doc = {
                "rule_id":       str(rule["_id"]),
                "rule_name":     rule.get("name", ""),
                "user_id":       user_id,
                "campaign_id":   camp["campaign_id"],
                "campaign_name": camp["campaign_name"],
                "platform":      rule.get("platform", ""),
                "metric":        rule["metric"],
                "operator":      rule["operator"],
                "threshold":     rule["threshold"],
                "actual_value":  actual,
                "action_taken":  rule.get("action", "alert"),
                "action_result": action_result,
                "triggered_at":  now,
            }
            await db["rule_triggers"].insert_one(trigger_doc)

            # Update rule stats
            await db["rules"].update_one(
                {"_id": rule["_id"]},
                {
                    "$set":  {"last_triggered_at": now, "updated_at": now},
                    "$inc":  {"triggered_count": 1},
                },
            )
            # Only fire once per rule per cycle (first matching campaign)
            break

    return triggered_count


async def _evaluation_loop(db: AsyncIOMotorDatabase):
    """Async loop — evaluates ALL users' rules every _EVAL_INTERVAL_SEC."""
    while True:
        try:
            user_ids = await db["rules"].distinct("user_id", {"enabled": True})
            for uid in user_ids:
                try:
                    n = await evaluate_user_rules(db, uid)
                    if n:
                        logger.info("Rules: %d trigger(s) for user %s", n, uid)
                except Exception as exc:
                    logger.error("Rule eval error for user %s: %s", uid, exc)
        except Exception as exc:
            logger.error("Rules evaluation loop error: %s", exc)
        await asyncio.sleep(_EVAL_INTERVAL_SEC)


def start_rules_evaluator():
    """Entry-point called from main.py lifespan — runs in a separate thread."""
    import asyncio as _asyncio

    async def _run():
        from motor.motor_asyncio import AsyncIOMotorClient
        from app.config import settings
        client = AsyncIOMotorClient(settings.mongodb_url)
        db = client[settings.mongodb_db_name]
        await _evaluation_loop(db)

    try:
        loop = _asyncio.new_event_loop()
        loop.run_until_complete(_run())
    except Exception as exc:
        logger.error("Rules evaluator thread crashed: %s", exc)
