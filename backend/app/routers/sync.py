"""
Sync API router — Phase 3.7.

Endpoints
---------
  POST /api/v1/sync/trigger/{connector_id}
      Enqueue an immediate sync for one connector.
      Returns the Celery task ID so the client can poll /sync/status.

  GET  /api/v1/sync/status/{connector_id}
      Current connector status + the most recent sync_run document.

  GET  /api/v1/sync/history/{connector_id}?limit=20&offset=0
      Paginated list of sync_run history for a connector.

All endpoints require a valid JWT (get_current_user).
The connector must belong to the authenticated user.
"""

import logging
import socket
import threading
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urlparse

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.config import settings
from app.database import get_db
from app.middleware.auth import get_current_user
from app.utils.response import error_response, success_response

logger = logging.getLogger(__name__)


def _broker_reachable(timeout: float = 1.0) -> bool:
    """
    Quick TCP probe: returns True only if the Celery broker (Redis) accepts
    a connection within `timeout` seconds.  Avoids hanging on sync_connector.delay()
    when Redis is down — kombu's default socket timeout can be infinite.
    """
    try:
        parsed = urlparse(settings.redis_url)
        host = parsed.hostname or "localhost"
        port = parsed.port or 6379
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


def _run_sync_in_thread(connector_id: str) -> None:
    """Run sync in an isolated daemon thread so it never blocks the ASGI server."""
    try:
        from app.services.sync_service import run_sync
        run_sync(connector_id)
    except Exception as exc:
        logger.error("Background sync thread error for connector=%s: %s", connector_id, exc)

router = APIRouter(prefix="/api/v1/sync", tags=["sync"])


# ── Helpers ────────────────────────────────────────────────────────────────────

def _dt_iso(dt: Optional[datetime]) -> Optional[str]:
    """Serialise a datetime (aware or naive UTC) to ISO-8601 string, or None."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


def _serialize_run(run: dict) -> dict:
    """Convert a sync_run MongoDB document to a JSON-safe dict."""
    return {
        "id":             str(run["_id"]),
        "connector_id":   run.get("connector_id"),
        "connector_name": run.get("connector_name"),
        "platform":       run.get("platform"),
        "status":         run.get("status"),
        "started_at":     _dt_iso(run.get("started_at")),
        "finished_at":    _dt_iso(run.get("finished_at")),
        "records_synced": run.get("records_synced", 0),
        "error":          run.get("error"),
    }


def _serialize_connector(doc: dict) -> dict:
    """Slim connector summary for sync status responses."""
    return {
        "id":                  str(doc["_id"]),
        "name":                doc.get("name"),
        "platform":            doc.get("platform"),
        "status":              doc.get("status"),
        "sync_frequency":      doc.get("sync_frequency"),
        "last_synced_at":      _dt_iso(doc.get("last_synced_at")),
        "error_message":       doc.get("error_message"),
        "platform_account_id": doc.get("platform_account_id"),
    }


async def _get_owned_connector(
    connector_id: str,
    user_id: str,
    db: AsyncIOMotorDatabase,
) -> Optional[dict]:
    """Fetch a connector that belongs to user_id; return None if not found."""
    try:
        oid = ObjectId(connector_id)
    except InvalidId:
        return None
    return await db["connectors"].find_one({"_id": oid, "user_id": user_id})


# ── POST /sync/trigger/{connector_id} ─────────────────────────────────────────

@router.post("/trigger/{connector_id}")
async def trigger_sync(
    connector_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Enqueue an immediate sync for the given connector.

    Tries Celery first; falls back to FastAPI BackgroundTasks when
    Celery/Redis is not running (dev environments without a broker).

    Validates:
      - connector exists and belongs to the authenticated user
      - connector has been authenticated (has an access token)

    Returns:
      { task_id, connector_id, status: "queued" }
    """
    user_id = str(current_user["_id"])
    connector = await _get_owned_connector(connector_id, user_id, db)
    if not connector:
        return error_response("Connector not found", status_code=404)

    if not connector.get("encrypted_access_token"):
        return error_response(
            "Connector is not authenticated. Complete OAuth first.",
            status_code=400,
        )

    # Probe the broker first (1-second TCP timeout) so we never block on
    # sync_connector.delay() when Redis is down — kombu's default socket
    # timeout is infinite and will freeze the endpoint for minutes.
    task_id: str
    mode: str
    if _broker_reachable(timeout=0.5):
        try:
            from app.tasks.sync_tasks import sync_connector
            task = sync_connector.delay(connector_id)
            task_id = task.id
            mode = "celery"
            logger.info("Sync queued via Celery: connector=%s task=%s", connector_id, task_id)
        except Exception as celery_exc:
            logger.warning("Celery enqueue failed (%s) — falling back to thread", celery_exc)
            mode = "background"
            task_id = ""
    else:
        logger.info("Broker not reachable — using daemon thread for connector=%s", connector_id)
        mode = "background"
        task_id = ""

    if mode == "background":
        t = threading.Thread(
            target=_run_sync_in_thread,
            args=(connector_id,),
            daemon=True,   # exits with process; won't block server shutdown
            name=f"sync-{connector_id[:8]}",
        )
        t.start()
        task_id = f"thread-{t.name}"

    return success_response(
        data={
            "task_id":      task_id,
            "connector_id": connector_id,
            "platform":     connector.get("platform"),
            "status":       "queued",
            "mode":         mode,
        },
        message="Sync queued successfully",
    )


# ── GET /sync/status/{connector_id} ───────────────────────────────────────────

@router.get("/status/{connector_id}")
async def get_sync_status(
    connector_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Return the current connector status and the most recent sync_run.

    Returns:
      {
        connector: { id, name, platform, status, last_synced_at, error_message, ... },
        latest_run: { id, status, started_at, finished_at, records_synced, error } | null
      }
    """
    user_id = str(current_user["_id"])
    connector = await _get_owned_connector(connector_id, user_id, db)
    if not connector:
        return error_response("Connector not found", status_code=404)

    # Most recent sync_run (started_at DESC)
    latest_run_doc = await db["sync_runs"].find_one(
        {"connector_id": connector_id},
        sort=[("started_at", -1)],
    )

    return success_response(
        data={
            "connector":  _serialize_connector(connector),
            "latest_run": _serialize_run(latest_run_doc) if latest_run_doc else None,
        },
        message="Sync status retrieved",
    )


# ── GET /sync/history/{connector_id} ──────────────────────────────────────────

@router.get("/history/{connector_id}")
async def get_sync_history(
    connector_id: str,
    limit: int  = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0,  ge=0),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Return paginated sync_run history for a connector.

    Query params:
      limit  (1-100, default 20)
      offset (default 0)

    Returns:
      { runs: [...], total: N, limit: N, offset: N }
    """
    user_id = str(current_user["_id"])
    connector = await _get_owned_connector(connector_id, user_id, db)
    if not connector:
        return error_response("Connector not found", status_code=404)

    total = await db["sync_runs"].count_documents({"connector_id": connector_id})

    cursor = (
        db["sync_runs"]
        .find({"connector_id": connector_id})
        .sort("started_at", -1)
        .skip(offset)
        .limit(limit)
    )
    runs = await cursor.to_list(length=limit)

    return success_response(
        data={
            "runs":   [_serialize_run(r) for r in runs],
            "total":  total,
            "limit":  limit,
            "offset": offset,
        },
        message="Sync history retrieved",
    )
