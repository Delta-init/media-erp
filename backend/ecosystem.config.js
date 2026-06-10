/**
 * PM2 Ecosystem — mediaERP Backend (Linux VPS)
 * ─────────────────────────────────────────────────────────────────────────────
 * Manages three processes:
 *   mediaerp-api     — FastAPI via gunicorn + uvicorn workers
 *   mediaerp-worker  — Celery worker (prefork pool, async task queue)
 *   mediaerp-beat    — Celery beat (hourly syncs + daily anomaly scan)
 *
 * Assumes a virtualenv at:  /root/media-erp/backend/venv
 * If your venv is elsewhere, update PY_BIN below.
 * If using system Python instead of a venv:
 *   const PY_BIN = "/usr/local/bin";   // or: $(dirname $(which gunicorn))
 *
 * Quick-start (run from /root/media-erp/backend):
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
 *   pm2 describe mediaerp-beat
 * ─────────────────────────────────────────────────────────────────────────────
 */

// Absolute path to the backend directory (cwd for all processes)
const BACKEND = "/root/media-erp/backend";

// Virtualenv bin directory — adjust if your venv lives elsewhere
const PY_BIN = `${BACKEND}/venv/bin`;

// Environment variables applied to all processes
const BASE_ENV = {
  PYTHONUNBUFFERED:        "1",     // real-time log output (no buffering)
  PYTHONDONTWRITEBYTECODE: "1",     // skip .pyc generation
  APP_ENV:                 "production",
};

module.exports = {
  apps: [

    // ── 1. FastAPI (gunicorn + uvicorn workers) ──────────────────────────────
    //
    //  • gunicorn manages the worker process pool; each worker is a full
    //    uvicorn ASGI server (handles async + WebSocket routes).
    //  • --workers 2 is a safe baseline for a single VPS. Rule of thumb:
    //    (2 × CPU cores) + 1. Override with WEB_CONCURRENCY env var.
    //  • --timeout 120 covers slow platform sync responses.
    //  • --access-logfile/--error-logfile - routes gunicorn's own logs to
    //    stdout/stderr so PM2 captures them in the log files below.
    //  • .env is resolved via an absolute path in app/config.py — no extra
    //    env_file handling needed here.
    // ─────────────────────────────────────────────────────────────────────────
    {
      name:   "mediaerp-api",
      script: `${PY_BIN}/gunicorn`,
      args: [
        "app.main:app",
        "--worker-class",    "uvicorn.workers.UvicornWorker",
        "--workers",         "2",
        "--bind",            "0.0.0.0:8000",
        "--timeout",         "120",
        "--graceful-timeout","30",
        "--log-level",       "info",
        "--access-logfile",  "-",
        "--error-logfile",   "-",
      ].join(" "),
      cwd:         BACKEND,
      interpreter: "none",

     
      autorestart:              true,
      watch:                    false,
      max_memory_restart:       "512M",
      restart_delay:            3000,
      exp_backoff_restart_delay:100,

      out_file:        "./logs/api-out.log",
      error_file:      "./logs/api-err.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs:      true,

      env: { ...BASE_ENV },
    },


    // ── 2. Celery Worker ─────────────────────────────────────────────────────
    //
    //  • --pool=prefork  — Linux supports fork(); this is Celery's default and
    //    best-performing pool. Each worker slot is a separate OS process.
    //  • --concurrency=2 — matches CELERY_CONCURRENCY in config.py.
    //    Increase if the VPS has more CPU cores and tasks are CPU-bound.
    //  • --queues=default — mirrors the queue used in Dockerfile.worker.
    //  • kill_timeout=30000 — gives in-flight tasks 30 s to finish before
    //    PM2 sends SIGKILL on restart/stop.
    // ─────────────────────────────────────────────────────────────────────────
    {
      name:   "mediaerp-worker",
      script: `${PY_BIN}/celery`,
      args: [
        "-A",  "app.tasks.celery_app",
        "worker",
        "--loglevel=info",
        "--concurrency=2",
        "--queues=default",
        "--pool=prefork",
        "--hostname=worker@%h",
      ].join(" "),
      cwd:         BACKEND,
      interpreter: "none",

      instances:                1,
      autorestart:              true,
      watch:                    false,
      max_memory_restart:       "512M",
      restart_delay:            5000,
      exp_backoff_restart_delay:100,
      kill_timeout:             30000,

      out_file:        "./logs/worker-out.log",
      error_file:      "./logs/worker-err.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs:      true,

      env: { ...BASE_ENV },
    },


    // ── 3. Celery Beat (scheduler) ───────────────────────────────────────────
    //
    //  • Fires two scheduled tasks:
    //      - run-scheduled-syncs-hourly  → top of every hour
    //      - scan-anomalies-daily        → 02:00 UTC
    //  • MUST run as a single instance — multiple beat processes fire
    //    duplicate tasks. Never set instances > 1 here.
    //  • --schedule persists the last-run state to ./celerybeat-schedule
    //    (relative to cwd) so restarts don't lose scheduler state.
    //  • Beat is separated from the worker (unlike Dockerfile.worker's -B flag)
    //    so PM2 can restart them independently.
    // ─────────────────────────────────────────────────────────────────────────
    // {
    //   name:   "mediaerp-beat",
    //   script: `${PY_BIN}/celery`,
    //   args: [
    //     "-A", "app.tasks.celery_app",
    //     "beat",
    //     "--loglevel=info",
    //     `--schedule=${BACKEND}/celerybeat-schedule`,
    //   ].join(" "),
    //   cwd:         BACKEND,
    //   interpreter: "none",

    //   instances:           1,   // ← NEVER increase; one beat per deployment
    //   autorestart:         true,
    //   watch:               false,
    //   max_memory_restart:  "128M",
    //   restart_delay:       5000,

    //   out_file:        "./logs/beat-out.log",
    //   error_file:      "./logs/beat-err.log",
    //   log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    //   merge_logs:      true,

    //   env: { ...BASE_ENV },
    // },

  ],
};
