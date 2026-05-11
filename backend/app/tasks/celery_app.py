"""
Celery application — Phase 3.2.

Broker  : Redis (redis://localhost:6379/0)
Backend : Redis (redis://localhost:6379/1)
Beat    : hourly scheduled sync via run_scheduled_syncs
"""
from celery import Celery
from celery.schedules import crontab
from app.config import settings

celery_app = Celery(
    "mediaerp",
    broker=settings.redis_url,
    backend=settings.redis_url.replace("/0", "/1"),  # separate DB for results
    include=["app.tasks.sync_tasks"],
)

celery_app.conf.update(
    # Serialization
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    # Timezone
    timezone="UTC",
    enable_utc=True,
    # Task behaviour
    task_acks_late=True,           # re-queue if worker dies mid-task
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,  # one task at a time per worker slot
    # Result TTL — keep results 24 h then expire
    result_expires=86400,
    # Beat schedule — run_scheduled_syncs every hour
    beat_schedule={
        "run-scheduled-syncs-hourly": {
            "task": "app.tasks.sync_tasks.run_scheduled_syncs",
            "schedule": crontab(minute=0),  # top of every hour
        },
    },
)
