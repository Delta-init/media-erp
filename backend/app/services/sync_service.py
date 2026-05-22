"""
Sync service core — Phase 3.3.

Platform-agnostic upsert logic used by Celery tasks.
Uses synchronous PyMongo (via get_sync_db) because Celery workers
run in a plain thread/process, not inside an asyncio event loop.

Flow per connector:
  1. Load connector doc → validate status + tokens
  2. Mark connector status = "syncing"
  3. Record sync_run (started_at)
  4. Dispatch to platform fetch_data() registry
  5. Bulk-upsert rows into marketing_data
  6. Mark connector status = "connected" | "error"
  7. Finalise sync_run (finished_at, records_synced, error)
"""
import logging
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from bson.errors import InvalidId
from pymongo import UpdateOne
from pymongo.errors import BulkWriteError

from app.database import get_sync_db
from app.models.marketing_data import upsert_filter
from app.utils.encryption import decrypt

logger = logging.getLogger(__name__)

# ── Platform fetch registry ───────────────────────────────────────────────────
# Platforms register their fetch_data function here in Phase 3.4-3.6.
# Key: platform string (e.g. "google_ads")
# Value: callable(connector: dict, tokens: dict) -> list[dict]
#        Each dict in the list is a marketing_data_doc()-shaped record.
PLATFORM_FETCH_REGISTRY: dict = {}


# ── Sync run helpers ──────────────────────────────────────────────────────────

def _create_sync_run(db, connector_id: str, connector_name: str, platform: str) -> str:
    """Insert a sync_run document and return its string ID."""
    doc = {
        "connector_id": connector_id,
        "connector_name": connector_name,
        "platform": platform,
        "status": "running",
        "started_at": datetime.now(timezone.utc),
        "finished_at": None,
        "records_synced": 0,
        "error": None,
    }
    result = db["sync_runs"].insert_one(doc)
    return str(result.inserted_id)


def _finish_sync_run(
    db,
    run_id: str,
    status: str,
    records_synced: int = 0,
    error: Optional[str] = None,
) -> None:
    """Update a sync_run document when the sync completes or fails."""
    db["sync_runs"].update_one(
        {"_id": ObjectId(run_id)},
        {
            "$set": {
                "status": status,
                "finished_at": datetime.now(timezone.utc),
                "records_synced": records_synced,
                "error": error,
            }
        },
    )


def _set_connector_status(db, connector_id: str, status: str, error: Optional[str] = None) -> None:
    """Update connector status + optional error_message + updated_at."""
    update = {
        "status": status,
        "updated_at": datetime.now(timezone.utc),
    }
    if status == "connected":
        update["last_synced_at"] = datetime.now(timezone.utc)
        update["error_message"] = None
    if error is not None:
        update["error_message"] = error
    try:
        oid = ObjectId(connector_id)
    except InvalidId:
        return
    db["connectors"].update_one({"_id": oid}, {"$set": update})


# ── Upsert helpers ────────────────────────────────────────────────────────────

def _bulk_upsert(db, rows: list[dict]) -> int:
    """
    Bulk-upsert marketing_data rows using the unique_data_point index.
    Returns the number of rows inserted or modified.
    """
    if not rows:
        return 0

    ops = []
    for row in rows:
        f = upsert_filter(
            user_id=row["user_id"],
            platform=row["platform"],
            date=row["date"],
            campaign_id=row["campaign_id"],
        )
        ops.append(
            UpdateOne(
                filter=f,
                update={"$set": row},
                upsert=True,
            )
        )

    try:
        result = db["marketing_data"].bulk_write(ops, ordered=False)
        return result.upserted_count + result.modified_count
    except BulkWriteError as bwe:
        # Log partial failures but don't raise — report what succeeded
        logger.warning("Bulk write partial error: %s", bwe.details)
        details = bwe.details
        return details.get("nUpserted", 0) + details.get("nModified", 0)


# ── Core sync function ────────────────────────────────────────────────────────

def run_sync(connector_id: str) -> dict:
    """
    Synchronous entry point called by the Celery sync_connector task.

    Returns:
        {
            "connector_id": str,
            "platform": str,
            "status": "success" | "error",
            "records_synced": int,
            "error": str | None,
            "sync_run_id": str,
        }
    """
    db = get_sync_db()
    run_id: Optional[str] = None

    # ── 1. Load connector ────────────────────────────────────────────────────
    try:
        oid = ObjectId(connector_id)
    except InvalidId:
        return {"connector_id": connector_id, "status": "error", "error": "Invalid connector ID"}

    connector = db["connectors"].find_one({"_id": oid})
    if not connector:
        return {"connector_id": connector_id, "status": "error", "error": "Connector not found"}

    platform = connector["platform"]
    connector_id_str = str(connector["_id"])

    # ── 2. Check platform is supported ──────────────────────────────────────
    # Social connectors (instagram, facebook_pages, instagram_login) don't sync
    # marketing analytics data — they exist purely for posting and DMs.
    # Skip them silently rather than marking them as "error".
    _SOCIAL_ONLY_PLATFORMS = {"instagram", "facebook_pages"}
    fetch_fn = PLATFORM_FETCH_REGISTRY.get(platform)
    if fetch_fn is None:
        if platform in _SOCIAL_ONLY_PLATFORMS:
            logger.info(
                "Skipping sync for social-only platform '%s' connector=%s — no marketing data to fetch",
                platform, connector_id_str,
            )
            return {
                "connector_id": connector_id_str,
                "platform": platform,
                "status": "skipped",
                "records_synced": 0,
                "error": None,
                "message": "Social connectors do not sync marketing data.",
            }
        err = f"No fetch_data registered for platform '{platform}'"
        logger.warning(err)
        _set_connector_status(db, connector_id_str, "error", error=err)
        return {"connector_id": connector_id_str, "platform": platform, "status": "error", "error": err}

    # ── 3. Validate tokens ───────────────────────────────────────────────────
    if not connector.get("encrypted_access_token"):
        err = "No access token — connector not authenticated"
        _set_connector_status(db, connector_id_str, "error", error=err)
        return {"connector_id": connector_id_str, "platform": platform, "status": "error", "error": err}

    tokens = {
        "access_token": decrypt(connector["encrypted_access_token"]),
        "refresh_token": (
            decrypt(connector["encrypted_refresh_token"])
            if connector.get("encrypted_refresh_token")
            else None
        ),
    }

    # ── 4. Mark syncing + create run record ──────────────────────────────────
    _set_connector_status(db, connector_id_str, "syncing")
    run_id = _create_sync_run(
        db,
        connector_id=connector_id_str,
        connector_name=connector.get("name", platform),
        platform=platform,
    )
    logger.info("Sync started: connector=%s platform=%s run=%s", connector_id_str, platform, run_id)

    # ── 5. Fetch + upsert ────────────────────────────────────────────────────
    user_id_str = str(connector.get("user_id", ""))
    try:
        rows: list[dict] = fetch_fn(connector, tokens)
        records_synced = _bulk_upsert(db, rows)
    except Exception as exc:
        err = str(exc)
        logger.exception("Sync failed: connector=%s error=%s", connector_id_str, err)
        _set_connector_status(db, connector_id_str, "error", error=err)
        _finish_sync_run(db, run_id, status="error", error=err)
        # Emit sync_error notification
        try:
            from app.services.notification_service import create_notification_sync
            create_notification_sync(
                db, user_id_str, "sync_error",
                title=f"{platform.replace('_', ' ').title()} sync failed",
                message=err[:200],
                metadata={"connector_id": connector_id_str, "platform": platform},
            )
        except Exception:
            pass
        return {
            "connector_id": connector_id_str,
            "platform": platform,
            "status": "error",
            "records_synced": 0,
            "error": err,
            "sync_run_id": run_id,
        }

    # ── 6. Mark connected + emit success notification ────────────────────────
    _set_connector_status(db, connector_id_str, "connected")
    _finish_sync_run(db, run_id, status="success", records_synced=records_synced)
    logger.info(
        "Sync complete: connector=%s records=%d run=%s",
        connector_id_str, records_synced, run_id,
    )
    try:
        from app.services.notification_service import create_notification_sync
        create_notification_sync(
            db, user_id_str, "sync_success",
            title=f"{platform.replace('_', ' ').title()} sync complete",
            message=f"Synced {records_synced} record(s) successfully.",
            metadata={"connector_id": connector_id_str, "platform": platform, "records": records_synced},
        )
    except Exception:
        pass

    return {
        "connector_id": connector_id_str,
        "platform": platform,
        "status": "success",
        "records_synced": records_synced,
        "error": None,
        "sync_run_id": run_id,
    }


# ── Platform registration ─────────────────────────────────────────────────────
#
# Each platform fetch module exposes a fetch_data(connector, tokens) -> list[dict]
# function that is registered here at import time.  Platforms added in later
# phases (3.6 Facebook, 3.8 LinkedIn, 3.9 TikTok) follow the same pattern.


def _register_platforms() -> None:
    """
    Import and register every platform fetch function into PLATFORM_FETCH_REGISTRY.
    Uses try/except so a missing optional dependency never breaks the whole module.
    """
    try:
        from app.services.google_ads_fetch import fetch_data as _gads
        PLATFORM_FETCH_REGISTRY["google_ads"] = _gads
        logger.info("Registered platform fetch: google_ads")
    except Exception as exc:  # pragma: no cover
        logger.warning("google_ads_fetch not available: %s", exc)

    try:
        from app.services.ga4_fetch import fetch_data as _ga4
        PLATFORM_FETCH_REGISTRY["ga4"] = _ga4
        logger.info("Registered platform fetch: ga4")
    except Exception as exc:  # pragma: no cover
        logger.warning("ga4_fetch not available: %s", exc)

    try:
        from app.services.facebook_ads_fetch import fetch_data as _fb
        PLATFORM_FETCH_REGISTRY["facebook_ads"] = _fb
        logger.info("Registered platform fetch: facebook_ads")
    except Exception as exc:  # pragma: no cover
        logger.warning("facebook_ads_fetch not available: %s", exc)

    try:
        from app.services.linkedin_ads_fetch import fetch_data as _li
        PLATFORM_FETCH_REGISTRY["linkedin_ads"] = _li
        logger.info("Registered platform fetch: linkedin_ads")
    except Exception as exc:  # pragma: no cover
        logger.warning("linkedin_ads_fetch not available: %s", exc)

    try:
        from app.services.tiktok_ads_fetch import fetch_data as _tt
        PLATFORM_FETCH_REGISTRY["tiktok_ads"] = _tt
        logger.info("Registered platform fetch: tiktok_ads")
    except Exception as exc:  # pragma: no cover
        logger.warning("tiktok_ads_fetch not available: %s", exc)

    try:
        from app.services.instagram_insights_fetch import fetch_data as _ig_insights
        PLATFORM_FETCH_REGISTRY["instagram_login"] = _ig_insights
        logger.info("Registered platform fetch: instagram_login")
    except Exception as exc:
        logger.warning("instagram_insights_fetch not available: %s", exc)

    try:
        from app.services.mailchimp_fetch import fetch_data as _mc
        PLATFORM_FETCH_REGISTRY["mailchimp"] = _mc
        logger.info("Registered platform fetch: mailchimp")
    except Exception as exc:
        logger.warning("mailchimp_fetch not available: %s", exc)

    try:
        from app.services.search_console_fetch import fetch_data as _sc
        PLATFORM_FETCH_REGISTRY["search_console"] = _sc
        logger.info("Registered platform fetch: search_console")
    except Exception as exc:
        logger.warning("search_console_fetch not available: %s", exc)

    try:
        from app.services.hubspot_fetch import fetch_data as _hs
        PLATFORM_FETCH_REGISTRY["hubspot"] = _hs
        logger.info("Registered platform fetch: hubspot")
    except Exception as exc:
        logger.warning("hubspot_fetch not available: %s", exc)

    try:
        from app.services.shopify_fetch import fetch_data as _shopify
        PLATFORM_FETCH_REGISTRY["shopify"] = _shopify
        logger.info("Registered platform fetch: shopify")
    except Exception as exc:
        logger.warning("shopify_fetch not available: %s", exc)


_register_platforms()


# ── Scheduled sync helper ─────────────────────────────────────────────────────

def get_due_connector_ids() -> list[str]:
    """
    Return connector IDs that are due for a scheduled sync.

    Rules:
      - status must be "connected" (skip disconnected/syncing/error)
      - sync_frequency "hourly"  → always due when Beat fires
      - sync_frequency "daily"   → due only if last_synced_at is None
                                   OR >23 hours ago (prevents double-fire)
      - sync_frequency "manual"  → never auto-synced
    """
    from datetime import timedelta

    db = get_sync_db()
    now = datetime.now(timezone.utc)
    cutoff_daily = now - timedelta(hours=23)

    cursor = db["connectors"].find(
        {
            "status": "connected",
            "sync_frequency": {"$in": ["hourly", "daily"]},
            "encrypted_access_token": {"$ne": None},
        },
        {"_id": 1, "sync_frequency": 1, "last_synced_at": 1},
    )

    due = []
    for doc in cursor:
        freq = doc["sync_frequency"]
        last = doc.get("last_synced_at")
        if freq == "hourly":
            due.append(str(doc["_id"]))
        elif freq == "daily":
            if last is None or last < cutoff_daily:
                due.append(str(doc["_id"]))
    return due
