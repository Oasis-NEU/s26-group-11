"""Optional NewsAPI client with a file-based daily budget guard.

NewsAPI free tier allows ~100 requests/day.  This module tracks usage in a
simple local file so you don't accidentally blow through the quota during
development.  In production, swap this for a Redis INCR with midnight-UTC TTL.
"""

import json
from datetime import date
from pathlib import Path

import requests

from app.core import config
from app.services.news.whitelist import (
    TIER_1_DOMAINS,
    TIER_2_DOMAINS,
    TIER_3_DOMAINS,
)

NEWSAPI_BASE = "https://newsapi.org/v2"
DAILY_LIMIT = 95
USAGE_FILE = Path(__file__).resolve().parent.parent.parent.parent / ".newsapi_usage.json"

_ALLOWED_DOMAINS = ",".join(sorted(TIER_1_DOMAINS | TIER_2_DOMAINS | TIER_3_DOMAINS))


def _read_usage() -> dict:
    if not USAGE_FILE.exists():
        return {"date": "", "count": 0}
    try:
        return json.loads(USAGE_FILE.read_text())
    except (json.JSONDecodeError, OSError):
        return {"date": "", "count": 0}


def _write_usage(usage: dict) -> None:
    USAGE_FILE.write_text(json.dumps(usage))


def _increment_usage() -> bool:
    """Increment today's counter. Returns True if under budget, False if over."""
    usage = _read_usage()
    today = date.today().isoformat()
    if usage.get("date") != today:
        usage = {"date": today, "count": 0}
    if usage["count"] >= DAILY_LIMIT:
        return False
    usage["count"] += 1
    _write_usage(usage)
    return True


def remaining_budget() -> int:
    usage = _read_usage()
    today = date.today().isoformat()
    if usage.get("date") != today:
        return DAILY_LIMIT
    return max(0, DAILY_LIMIT - usage.get("count", 0))


class NewsAPIBudgetExceeded(Exception):
    pass


def search_news(
    query: str,
    from_date: date | None = None,
    to_date: date | None = None,
    page_size: int = 20,
) -> list[dict]:
    """Search NewsAPI /everything for articles matching query within allowed domains.

    Raises NewsAPIBudgetExceeded if daily quota is exhausted.
    Returns the raw 'articles' list from the response.
    """
    if not config.NEWSAPI_API_KEY:
        return []

    if not _increment_usage():
        raise NewsAPIBudgetExceeded(
            f"Daily NewsAPI limit ({DAILY_LIMIT}) reached. "
            f"Remaining: {remaining_budget()}"
        )

    params: dict = {
        "q": query,
        "domains": _ALLOWED_DOMAINS,
        "sortBy": "publishedAt",
        "pageSize": page_size,
        "language": "en",
        "apiKey": config.NEWSAPI_API_KEY,
    }
    if from_date:
        params["from"] = from_date.isoformat()
    if to_date:
        params["to"] = to_date.isoformat()

    resp = requests.get(
        f"{NEWSAPI_BASE}/everything", params=params, timeout=15
    )
    resp.raise_for_status()
    data = resp.json()
    return data.get("articles", [])
