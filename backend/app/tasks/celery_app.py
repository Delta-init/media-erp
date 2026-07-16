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
    # Timezone — mediaERP runs on IST; beat crontabs below are IST wall-clock.
    # (Messages are still transported as UTC instants; enable_utc=False only
    #  changes how the beat schedule interprets clock times.)
    timezone="Asia/Kolkata",
    enable_utc=False,
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
        "scan-anomalies-daily": {
            "task": "app.tasks.sync_tasks.scan_anomalies_all_users",
            "schedule": crontab(hour=2, minute=0),  # 02:00 IST daily
        },
    },
)
