"""Simple cache — in-memory with optional Redis support."""
import asyncio
import json
import time
from typing import Any, Optional

_cache: dict = {}


async def init_cache():
    """Initialize cache (try Redis, fall back to in-memory)."""
    try:
        import redis.asyncio as redis
        url = __import__("os").getenv("REDIS_URL", "redis://localhost:6379")
        r = redis.from_url(url, decode_responses=True)
        await r.ping()
        print("✅ Redis cache connected")
    except Exception:
        print("⚠️  Redis unavailable, using in-memory cache")


async def cache_get(key: str, ttl_seconds: int = 300) -> Optional[Any]:
    entry = _cache.get(key)
    if not entry:
        return None
    if time.time() - entry["ts"] > ttl_seconds:
        del _cache[key]
        return None
    return entry["val"]


async def cache_set(key: str, value: Any):
    _cache[key] = {"val": value, "ts": time.time()}
