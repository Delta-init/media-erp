"""
Media schedule background service.
Daemon thread runs every 60 s — activates tasks whose start_date has arrived.
"""
import logging
import time
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


def start_media_scheduler():
    """Entry point for the daemon thread. Runs forever."""
    logger.info("Media schedule scheduler started")
    while True:
        try:
            _activate_due_tasks()
        except Exception:
            logger.exception("media_schedule: error in activation loop")
        time.sleep(60)


def _activate_due_tasks():
    from app.database import get_sync_db
    from app.services.notification_service import create_notification_sync

    db = get_sync_db()
    now = datetime.now(timezone.utc)

    tasks = list(db["media_tasks"].find({
        "start_date": {"$lte": now},
        "status": "scheduled",
    }))

    if not tasks:
        return

    logger.info("media_schedule: activating %d tasks", len(tasks))

    for task in tasks:
        task_id = task["_id"]
        result = db["media_tasks"].update_one(
            {"_id": task_id, "status": "scheduled"},
            {"$set": {"status": "active", "updated_at": now}},
        )
        if result.modified_count == 0:
            continue  # another thread already activated it

        assigned_to = task.get("assigned_to")
        if assigned_to:
            try:
                create_notification_sync(
                    db,
                    assigned_to,
                    "task_assigned",
                    "Media Task Active",
                    f"Your media task \"{task.get('title', 'Untitled')}\" is now active.",
                    metadata={
                        "media_task_id": str(task_id),
                        "team_id": task.get("team_id"),
                    },
                )
            except Exception:
                logger.exception("media_schedule: failed to notify user %s", assigned_to)

        logger.info("media_schedule: activated task %s", task_id)
