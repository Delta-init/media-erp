"""
Celery sync tasks — Phase 3.3.

sync_connector      — syncs a single connector by ID (calls sync_service.run_sync)
run_scheduled_syncs — Beat entry point; enqueues sync for every due connector
"""
from celery.utils.log import get_task_logger
from app.tasks.celery_app import celery_app

logger = get_task_logger(__name__)


@celery_app.task(
    bind=True,
    name="app.tasks.sync_tasks.sync_connector",
    max_retries=3,
    default_retry_delay=60,  # retry after 60 s on transient failures
    autoretry_for=(Exception,),
    retry_backoff=True,
)
def sync_connector(self, connector_id: str) -> dict:
    """
    Sync a single connector by ID.

    Delegates to sync_service.run_sync() which handles:
      - token decryption
      - platform fetch dispatch (PLATFORM_FETCH_REGISTRY)
      - bulk upsert into marketing_data
      - sync_run record lifecycle
      - connector status updates

    Returns a status dict stored as the Celery task result.
    """
    logger.info("sync_connector started: connector_id=%s attempt=%d", connector_id, self.request.retries + 1)
    from app.services.sync_service import run_sync
    result = run_sync(connector_id)
    if result.get("status") == "error":
        logger.warning(
            "sync_connector error: connector_id=%s error=%s",
            connector_id, result.get("error"),
        )
    else:
        logger.info(
            "sync_connector success: connector_id=%s records=%d",
            connector_id, result.get("records_synced", 0),
        )
    return result


@celery_app.task(name="app.tasks.sync_tasks.run_scheduled_syncs")
def run_scheduled_syncs() -> dict:
    """
    Beat entry point — runs every hour (top of the hour via crontab(minute=0)).

    Queries connectors that are due for a scheduled sync via
    sync_service.get_due_connector_ids(), then enqueues sync_connector
    for each one.

    Rules (enforced in get_due_connector_ids):
      - hourly  → always enqueued when Beat fires
      - daily   → enqueued only if last_synced_at is None or >23 h ago
      - manual  → never auto-synced
    """
    logger.info("run_scheduled_syncs triggered by Beat")
    from app.services.sync_service import get_due_connector_ids

    due_ids = get_due_connector_ids()
    logger.info("run_scheduled_syncs: %d connector(s) due", len(due_ids))

    for cid in due_ids:
        sync_connector.delay(cid)
        logger.info("run_scheduled_syncs: enqueued sync for connector_id=%s", cid)

    return {"status": "ok", "connectors_queued": len(due_ids)}
