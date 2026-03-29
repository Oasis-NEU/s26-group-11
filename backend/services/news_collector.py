"""
Collects stock-related news from NewsAPI, filtered to whitelisted sources.
"""

import os
from datetime import datetime, timezone, timedelta
from urllib.parse import urlparse

import requests

from .credibility import score_news

# Source whitelist — keys match domains returned by NewsAPI
WHITELISTED_SOURCES = {
    "bloomberg.com", "reuters.com", "wsj.com", "ft.com",
    "cnbc.com", "marketwatch.com", "barrons.com", "seekingalpha.com",
    "finance.yahoo.com", "businessinsider.com", "forbes.com",
}

NEWSAPI_BASE = "https://newsapi.org/v2/everything"


def _extract_domain(url: str) -> str:
    try:
        return urlparse(url).netloc.replace("www.", "")
    except Exception:
        return ""


def collect_for_ticker(ticker: str, days_back: int = 1) -> list[dict]:
    """
    Fetch news articles mentioning `ticker` from whitelisted sources.
    Returns raw mention dicts ready for sentiment analysis.
    """
    api_key = os.environ.get("NEWS_API_KEY", "")
    if not api_key:
        return []

    from_date = (datetime.now(timezone.utc) - timedelta(days=days_back)).strftime("%Y-%m-%d")

    params = {
        "q": f'"{ticker}" stock OR shares',
        "from": from_date,
        "language": "en",
        "sortBy": "publishedAt",
        "pageSize": 20,
        "apiKey": api_key,
    }

    try:
        response = requests.get(NEWSAPI_BASE, params=params, timeout=10)
        response.raise_for_status()
        articles = response.json().get("articles", [])
    except Exception:
        return []

    results = []
    for article in articles:
        url = article.get("url", "")
        domain = _extract_domain(url)

        # Only whitelisted sources
        matched_source = next(
            (src for src in WHITELISTED_SOURCES if src in domain),
            None,
        )
        if not matched_source:
            continue

        credibility = score_news(matched_source)
        if credibility == 0:
            continue

        published_str = article.get("publishedAt", "")
        try:
            published_at = datetime.fromisoformat(published_str.replace("Z", "+00:00"))
        except Exception:
            published_at = datetime.now(timezone.utc)

        text = " ".join(filter(None, [
            article.get("title", ""),
            article.get("description", ""),
        ]))

        results.append({
            "source": "news",
            "external_id": url,
            "text": text[:1000],
            "url": url,
            "author": article.get("author"),
            "author_account_age_days": None,
            "author_karma": None,
            "author_verified": True,    # Whitelisted sources treated as verified
            "upvotes": 0,
            "comments": 0,
            "news_source": matched_source,
            "credibility_score": credibility,
            "published_at": published_at,
        })

    return results
