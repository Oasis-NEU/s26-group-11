"""
Reddit mentions client — uses Reddit's public JSON API (no auth required).

Endpoints used:
  /r/{sub}/search.json?q={ticker}&restrict_sr=1&sort=new   — subreddit search
  /search.json?q={ticker}+stock&sort=new                   — global search fallback

No API keys needed. Reddit allows ~60 req/min from a descriptive User-Agent.
"""
from __future__ import annotations

import logging
import time
from datetime import datetime, timezone

import requests

log = logging.getLogger(__name__)

SUBREDDITS = [
    "wallstreetbets",
    "stocks",
    "investing",
    "StockMarket",
    "ValueInvesting",
]

_HEADERS = {
    "User-Agent": "SentimentSignal/1.0 (financial sentiment research; contact: noreply@sentimentsignal.com)",
    "Accept": "application/json",
}

_BASE = "https://www.reddit.com"
_TIMEOUT = 10


def _get(url: str, params: dict | None = None) -> dict | None:
    try:
        r = requests.get(url, headers=_HEADERS, params=params, timeout=_TIMEOUT)
        if r.status_code == 429:
            log.warning(f"[reddit] rate limited, waiting 5s")
            time.sleep(5)
            r = requests.get(url, headers=_HEADERS, params=params, timeout=_TIMEOUT)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        log.warning(f"[reddit] GET {url} failed: {e}")
        return None


def _parse_post(child: dict, subreddit_hint: str | None = None) -> dict | None:
    d = child.get("data", {})
    title = (d.get("title") or "").strip()
    if not title:
        return None

    permalink = d.get("permalink", "")
    url = f"{_BASE}{permalink}" if permalink.startswith("/") else d.get("url", "")
    if not url:
        return None

    # Body text
    body = (d.get("selftext") or "").strip()
    if body in ("[removed]", "[deleted]"):
        body = ""
    summary = body[:1000] if body else None

    subreddit = d.get("subreddit") or subreddit_hint or "reddit"

    return {
        "url":           url,
        "title":         title,
        "summary":       summary,
        "published_at":  datetime.fromtimestamp(d.get("created_utc", 0), tz=timezone.utc),
        "upvotes":       d.get("score", 0),
        "subreddit":     subreddit,
        "source_domain": f"reddit.com/r/{subreddit}",
    }


def fetch_reddit_comments(permalink: str, limit: int = 15) -> list[dict]:
    """
    Fetch top comments from a Reddit post.

    Args:
        permalink: The post permalink (e.g. /r/wallstreetbets/comments/abc123/...)
        limit: Max number of comments to return

    Returns:
        List of comment dicts with keys matching the post schema.
    """
    url = f"{_BASE}{permalink}.json"
    data = _get(url, params={"limit": limit, "depth": 1})
    if not data or not isinstance(data, list) or len(data) < 2:
        return []

    comments_listing = data[1]
    children = comments_listing.get("data", {}).get("children", [])

    results = []
    for child in children:
        if child.get("kind") != "t1":
            continue
        d = child.get("data", {})
        body = (d.get("body") or "").strip()
        if not body or body in ("[removed]", "[deleted]"):
            continue

        comment_id = d.get("id", "")
        subreddit = d.get("subreddit", "reddit")
        comment_url = f"{_BASE}{permalink}?comment={comment_id}"

        results.append({
            "url":           comment_url,
            "title":         body[:120],
            "summary":       body[:500],
            "published_at":  datetime.fromtimestamp(d.get("created_utc", 0), tz=timezone.utc),
            "upvotes":       d.get("score", 0),
            "subreddit":     subreddit,
            "source_domain": f"reddit.com/r/{subreddit}",
            "is_comment":    True,
        })

    return results


def fetch_reddit_mentions(ticker: str, limit_per_sub: int = 15) -> list[dict]:
    """
    Search SUBREDDITS for posts mentioning `ticker`.
    Uses Reddit's public JSON API — no credentials required.
    """
    ticker_upper = ticker.upper()
    query = f"${ticker_upper} OR \"{ticker_upper}\""

    results: list[dict] = []
    seen_urls: set[str] = set()

    # 1. Per-subreddit restricted search
    for sub in SUBREDDITS:
        url  = f"{_BASE}/r/{sub}/search.json"
        data = _get(url, params={
            "q":           query,
            "restrict_sr": "1",
            "sort":        "new",
            "t":           "week",
            "limit":       limit_per_sub,
        })
        if not data:
            continue

        children = data.get("data", {}).get("children", [])
        for child in children:
            post = _parse_post(child, subreddit_hint=sub)
            if post and post["url"] not in seen_urls:
                seen_urls.add(post["url"])
                results.append(post)

        # Be polite — 1 second delay between subreddit calls to avoid 429s
        time.sleep(1)

    # 2. Global search — catches cross-posts and subs not in our list
    if len(results) < 10:
        data = _get(f"{_BASE}/search.json", params={
            "q":     f"{query} stock",
            "sort":  "new",
            "t":     "week",
            "limit": 25,
        })
        if data:
            for child in data.get("data", {}).get("children", []):
                post = _parse_post(child)
                if post and post["url"] not in seen_urls:
                    seen_urls.add(post["url"])
                    results.append(post)

    # 3. Fetch top comments from the top 3 posts (by upvotes)
    top_posts = sorted(
        [r for r in results if r.get("url")],
        key=lambda p: p.get("upvotes", 0),
        reverse=True,
    )[:3]

    seen_comment_urls: set[str] = set()
    for post in top_posts:
        # Extract permalink from the post URL
        post_url = post.get("url", "")
        # post URL is like https://www.reddit.com/r/sub/comments/...
        if not post_url.startswith(_BASE):
            continue
        permalink = post_url[len(_BASE):]
        if not permalink:
            continue

        comments = fetch_reddit_comments(permalink, limit=15)
        for c in comments:
            if c["url"] not in seen_comment_urls and c["url"] not in seen_urls:
                seen_comment_urls.add(c["url"])
                results.append(c)

        time.sleep(1.5)

    log.info(f"[reddit] {ticker_upper}: {len(results)} posts+comments via public JSON API")
    return results
