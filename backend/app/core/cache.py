"""
Lightweight in-process TTL cache.
Avoids repeated yfinance / DB calls for the same hot data within a short window.
"""
import time
from typing import Any

_store: dict[str, tuple[float, Any]] = {}  # key -> (expires_at, value)


def get(key: str) -> Any | None:
    entry = _store.get(key)
    if entry is None:
        return None
    expires_at, value = entry
    if time.monotonic() > expires_at:
        del _store[key]
        return None
    return value


def set(key: str, value: Any, ttl: int = 300) -> None:
    """Cache *value* under *key* for *ttl* seconds (default 5 min)."""
    _store[key] = (time.monotonic() + ttl, value)


def delete(key: str) -> None:
    """Remove a key from the cache (no-op if absent)."""
    _store.pop(key, None)


def cached(key: str, ttl: int = 300):
    """Decorator: cache the return value of the wrapped function."""
    def decorator(fn):
        def wrapper(*args, **kwargs):
            hit = get(key)
            if hit is not None:
                return hit
            result = fn(*args, **kwargs)
            set(key, result, ttl)
            return result
        return wrapper
    return decorator
