"""
Rate-limit middleware — sliding-window counter backed by Redis.

Limits (per 60-second window):
  • Global per-IP:        300 requests
  • Auth endpoints:        60 requests  (brute-force protection)
  • /api/v1/sync:          30 requests  (expensive sync operations)

All limits are soft-fail: if Redis is unavailable the request passes through.

Headers returned on every request:
  X-RateLimit-Limit    — window limit for this bucket
  X-RateLimit-Remaining — remaining requests in this window
  X-RateLimit-Reset    — UTC epoch seconds when the window resets
"""
import time
import logging
from typing import Callable

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from app.config import settings

logger = logging.getLogger(__name__)

# ── Route-specific limits ─────────────────────────────────────────────────────

_LIMITS: list[tuple[str, int]] = [
    # (path_prefix,   max_requests_per_window)
    ("/api/v1/auth",  60),
    ("/api/v1/sync",  30),
]
_DEFAULT_LIMIT = 300   # per IP per window
_WINDOW_SECS   = 60    # sliding-window length


def _get_limit(path: str) -> int:
    for prefix, limit in _LIMITS:
        if path.startswith(prefix):
            return limit
    return _DEFAULT_LIMIT


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Starlette middleware that enforces per-IP sliding-window rate limits using
    Redis INCR + EXPIRE.  Falls back to allow-all when Redis is unavailable.
    """

    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)
        self._redis = None
        self._init_failed = False

    def _get_redis(self):
        if self._init_failed:
            return None
        if self._redis is not None:
            return self._redis
        try:
            import redis.asyncio as aioredis
            self._redis = aioredis.from_url(
                settings.redis_url,
                encoding="utf-8",
                decode_responses=True,
                socket_connect_timeout=1,
                socket_timeout=1,
            )
        except Exception as exc:
            logger.warning("RateLimit: Redis init failed — rate limiting disabled: %s", exc)
            self._init_failed = True
        return self._redis

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        path = request.url.path

        # Skip non-API paths (uploads, WebSocket, docs)
        if not path.startswith("/api/v1/") or path.startswith("/api/v1/chat/ws"):
            return await call_next(request)

        redis = self._get_redis()
        if redis is None:
            return await call_next(request)

        client_ip = (
            request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
            or request.headers.get("X-Real-IP", "")
            or (request.client.host if request.client else "unknown")
        )

        limit = _get_limit(path)
        now   = int(time.time())
        window_start = now - (now % _WINDOW_SECS)  # align to window boundary
        key   = f"rl:{client_ip}:{window_start}"
        reset = window_start + _WINDOW_SECS

        try:
            count = await redis.incr(key)
            if count == 1:
                await redis.expire(key, _WINDOW_SECS + 5)  # +5 s buffer
        except Exception as exc:
            logger.debug("RateLimit: Redis error (allowing request): %s", exc)
            return await call_next(request)

        remaining = max(0, limit - count)
        headers = {
            "X-RateLimit-Limit":     str(limit),
            "X-RateLimit-Remaining": str(remaining),
            "X-RateLimit-Reset":     str(reset),
        }

        if count > limit:
            return JSONResponse(
                status_code=429,
                content={
                    "success": False,
                    "message": "Too many requests — please slow down and try again shortly.",
                    "data": None,
                },
                headers={**headers, "Retry-After": str(_WINDOW_SECS)},
            )

        response = await call_next(request)
        for k, v in headers.items():
            response.headers[k] = v
        return response
