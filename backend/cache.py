"""Split TTL in-memory caching layer.

Namespaces:
    financial:* — Long TTL (hours/days) for fundamental data
    news:*      — Short TTL (10-15 minutes) for news articles

Features:
    - Namespace-aware TTL
    - Stale fallback on external service failure
    - Automatic cleanup of expired entries
"""

from __future__ import annotations

import asyncio
import time
import logging
from dataclasses import dataclass, field
from typing import Any

from backend.config import get_settings

logger = logging.getLogger(__name__)


@dataclass
class CacheEntry:
    """A single cache entry with expiration tracking."""
    value: Any
    expires_at: float
    created_at: float = field(default_factory=time.time)
    
    @property
    def is_expired(self) -> bool:
        return time.time() > self.expires_at


class SplitTTLCache:
    """In-memory cache with namespace-aware TTL and stale fallback."""
    
    def __init__(self, ttl_overrides: dict[str, int] | None = None):
        settings = get_settings()
        self._store: dict[str, CacheEntry] = {}
        self._lock = asyncio.Lock()
        self._ttls = {
            "financial": settings.FINANCIAL_CACHE_TTL,
            "news": settings.NEWS_CACHE_TTL,
        }
        if ttl_overrides:
            self._ttls.update(ttl_overrides)
    
    def _make_key(self, namespace: str, key: str) -> str:
        """Create a namespaced cache key."""
        return f"{namespace}:{key}"
    
    def _get_ttl(self, namespace: str) -> int:
        """Get TTL for a namespace, defaulting to 3600 seconds."""
        return self._ttls.get(namespace, 3600)
    
    async def get(self, namespace: str, key: str) -> Any | None:
        """Get a value from cache. Returns None if not found or expired."""
        full_key = self._make_key(namespace, key)
        async with self._lock:
            entry = self._store.get(full_key)
            if entry is None:
                return None
            if not entry.is_expired:
                logger.debug(f"Cache HIT: {full_key}")
                return entry.value
            logger.debug(f"Cache EXPIRED: {full_key}")
            return None
    
    async def get_stale(self, namespace: str, key: str) -> Any | None:
        """Get a value from cache even if expired (stale fallback)."""
        full_key = self._make_key(namespace, key)
        async with self._lock:
            entry = self._store.get(full_key)
            if entry is not None:
                logger.info(f"Cache STALE FALLBACK: {full_key}")
                return entry.value
            return None
    
    async def set(self, namespace: str, key: str, value: Any) -> None:
        """Store a value in cache with namespace-appropriate TTL."""
        full_key = self._make_key(namespace, key)
        ttl = self._get_ttl(namespace)
        async with self._lock:
            self._store[full_key] = CacheEntry(
                value=value,
                expires_at=time.time() + ttl,
            )
            logger.debug(f"Cache SET: {full_key} (TTL={ttl}s)")
    
    async def invalidate(self, namespace: str, key: str) -> None:
        """Remove a specific entry from the cache."""
        full_key = self._make_key(namespace, key)
        async with self._lock:
            self._store.pop(full_key, None)
            logger.debug(f"Cache INVALIDATED: {full_key}")
    
    async def cleanup(self) -> int:
        """Remove all expired entries. Returns count of removed entries."""
        async with self._lock:
            expired_keys = [
                k for k, v in self._store.items() if v.is_expired
            ]
            for k in expired_keys:
                del self._store[k]
            if expired_keys:
                logger.info(f"Cache CLEANUP: removed {len(expired_keys)} expired entries")
            return len(expired_keys)
    
    async def clear(self) -> None:
        """Clear all cache entries."""
        async with self._lock:
            self._store.clear()
            logger.info("Cache CLEARED")
    
    @property
    def size(self) -> int:
        """Current number of entries in cache."""
        return len(self._store)


# Module-level singleton
_cache_instance: SplitTTLCache | None = None


def get_cache() -> SplitTTLCache:
    """Get or create the global cache singleton."""
    global _cache_instance
    if _cache_instance is None:
        _cache_instance = SplitTTLCache()
    return _cache_instance
