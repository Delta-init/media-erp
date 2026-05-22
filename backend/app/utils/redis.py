"""Shared async Redis client — lazy-initialised, soft-fail."""
import logging
import redis.asyncio as aioredis
from app.config import settings

logger = logging.getLogger(__name__)
_redis = None


def get_redis():
    global _redis
    if _redis is not None:
        return _redis
    try:
        _redis = aioredis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
            socket_connect_timeout=1,
            socket_timeout=1,
        )
    except Exception as exc:
        logger.warning("Redis init failed — caching disabled: %s", exc)
        return None
    return _redis
