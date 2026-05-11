# ── Stage 1: base + system deps ───────────────────────────────────────────────
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# ── Stage 2: dependency install (cached layer) ────────────────────────────────
FROM base AS deps

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ── Stage 3: production runtime ───────────────────────────────────────────────
FROM deps AS runtime

# Non-root user for security
RUN addgroup --system appgroup \
 && adduser  --system --ingroup appgroup --no-create-home appuser

# Copy application code (owned by non-root)
COPY --chown=appuser:appgroup . .

USER appuser

EXPOSE 8000

# Healthcheck — hits the /api/v1/health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c \
    "import urllib.request, sys, os; \
     p = os.environ.get('PORT', '8000'); \
     r = urllib.request.urlopen(f'http://localhost:{p}/api/v1/health', timeout=4); \
     sys.exit(0 if r.status == 200 else 1)"

# Production: gunicorn manages workers; uvicorn handles async
# WEB_CONCURRENCY defaults to 2 — override via env in compose / Railway
ENV WEB_CONCURRENCY=2

CMD gunicorn app.main:app \
    --worker-class uvicorn.workers.UvicornWorker \
    --workers ${WEB_CONCURRENCY} \
    --bind 0.0.0.0:${PORT:-8000} \
    --timeout 120 \
    --graceful-timeout 30 \
    --log-level info \
    --access-logfile - \
    --error-logfile -
