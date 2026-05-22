/**
 * PM2 Ecosystem — mediaERP Backend
 * ─────────────────────────────────────────────────────────────────────────────
 * Manages three processes:
 *   mediaerp-api     — FastAPI via uvicorn (HTTP + WebSocket server)
 *   mediaerp-worker  — Celery worker (async task queue)
 *   mediaerp-beat    — Celery beat (hourly scheduled syncs)
 *
 * Quick-start:
 *   pm2 start ecosystem.config.js       # start all three
 *   pm2 stop    all                     # stop all
 *   pm2 restart all                     # rolling restart
 *   pm2 delete  all                     # remove from PM2 registry
 *   pm2 logs                            # stream all logs
 *   pm2 monit                           # live CPU / memory dashboard
 *   pm2 save && pm2 startup             # persist across reboots
 *
 * Per-process:
 *   pm2 restart mediaerp-api
 *   pm2 logs    mediaerp-worker --lines 200
 * ─────────────────────────────────────────────────────────────────────────────
 */

// Absolute path to the backend directory (cwd for every process)
const BACKEND = "C:\\Users\\MSI-PC\\Delta\\mediaERP\\backend";

// Python 3.10 Scripts folder — where uvicorn.exe / celery.exe live
const PY_SCRIPTS = "C:\\Users\\MSI-PC\\AppData\\Local\\Programs\\Python\\Python310\\Scripts";

// Environment variables applied to all processes
const BASE_ENV = {
  PYTHONUNBUFFERED: "1",          // real-time log output (no buffering)
  PYTHONDONTWRITEBYTECODE: "1",   // skip .pyc generation
  APP_ENV: "development",
};

module.exports = {
  apps: [

    // ── 1. FastAPI (uvicorn) ─────────────────────────────────────────────────
    //
    //  • Single uvicorn process; --workers 2 spawns two async sub-workers via
    //    Python multiprocessing (spawn context — safe on Windows).
    //  • WebSocket routes (chat) are handled by the same process.
    //  • .env is loaded by pydantic-settings using an absolute path derived
    //    from app/config.py, so no extra env_file handling is needed here.
    // ─────────────────────────────────────────────────────────────────────────
    {
      name: "mediaerp-api",
      script: `${PY_SCRIPTS}\\uvicorn.exe`,
      args: [
        "app.main:app",
        "--host", "0.0.0.0",
        "--port", "8000",
        "--workers", "2",
        "--log-level", "info",
      ].join(" "),
      cwd: BACKEND,
      interpreter: "none",

      // Process config
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      restart_delay: 3000,   // ms — wait before auto-restart on crash
      exp_backoff_restart_delay: 100,

      // Logging
      out_file: "./logs/api-out.log",
      error_file: "./logs/api-err.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,

      env: { ...BASE_ENV },
    },


    // ── 2. Celery Worker ─────────────────────────────────────────────────────
    //
    //  • --pool=threads  — the default "prefork" pool uses fork() which is
    //    not available on Windows; "threads" runs tasks in OS threads instead.
    //    Switch to "gevent" if you add gevent to requirements.txt.
    //  • --concurrency=2 — two concurrent task slots (matches CELERY_CONCURRENCY).
    //  • --queues=default — explicit queue binding (mirrors Dockerfile.worker).
    //  • Celery auto-discovers the `celery_app` Celery instance in the module
    //    because Celery 5.x scans all module attributes when no name is given.
    // ─────────────────────────────────────────────────────────────────────────
    {
      name: "mediaerp-worker",
      script: `${PY_SCRIPTS}\\celery.exe`,
      args: [
        "-A", "app.tasks.celery_app",
        "worker",
        "--loglevel=info",
        "--concurrency=2",
        "--queues=default",
        "--pool=threads",
        "--hostname=worker@%h",
      ].join(" "),
      cwd: BACKEND,
      interpreter: "none",

      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      restart_delay: 5000,
      exp_backoff_restart_delay: 100,

      out_file: "./logs/worker-out.log",
      error_file: "./logs/worker-err.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,

      env: { ...BASE_ENV },

      // Give the worker time to drain in-flight tasks before SIGKILL
      kill_timeout: 30000,
    },


    // ── 3. Celery Beat (scheduler) ───────────────────────────────────────────
    //
    //  • Fires the "run-scheduled-syncs-hourly" task at the top of every hour
    //    (defined in app/tasks/celery_app.py beat_schedule).
    //  • Beat must run as a single instance — running more than one beat
    //    process causes duplicate task submissions.
    //  • --schedule stores the persistent last-run state. Kept inside the
    //    backend directory so it survives restarts.
    //  • Beat is separated from the worker (vs the combined -B flag in
    //    Dockerfile.worker) so PM2 can restart them independently.
    // ─────────────────────────────────────────────────────────────────────────
    {
      name: "mediaerp-beat",
      script: `${PY_SCRIPTS}\\celery.exe`,
      args: [
        "-A", "app.tasks.celery_app",
        "beat",
        "--loglevel=info",
        "--schedule=./celerybeat-schedule",
      ].join(" "),
      cwd: BACKEND,
      interpreter: "none",

      instances: 1,        // NEVER scale beat — duplicate beats = duplicate tasks
      autorestart: true,
      watch: false,
      max_memory_restart: "128M",
      restart_delay: 5000,

      out_file: "./logs/beat-out.log",
      error_file: "./logs/beat-err.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,

      env: { ...BASE_ENV },
    },

  ],
};
