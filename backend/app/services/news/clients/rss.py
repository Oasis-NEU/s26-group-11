"""
RSS feed client for financial news sources.
No API keys required — all feeds are freely accessible.

Ticker-specific feeds (guaranteed relevant):
  - Yahoo Finance    https://finance.yahoo.com/rss/headline?s={ticker}
  - Seeking Alpha    https://seekingalpha.com/symbol/{ticker}.xml
  - Benzinga         https://www.benzinga.com/stock/{ticker}/feed

Broad feeds (filtered by ticker mention in headline):
  - Reuters          https://feeds.reuters.com/reuters/businessNews
  - CNBC             https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114
  - MarketWatch      https://feeds.marketwatch.com/marketwatch/topstories
  - Motley Fool      https://www.fool.com/feeds/index.aspx
"""
from __future__ import annotations

import re
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

import feedparser
import requests

# ── Ticker-specific feed URLs ────────────────────────────────────────────────
TICKER_FEEDS: list[tuple[str, str]] = [
    # (url_template, source_label)
    ("https://finance.yahoo.com/rss/headline?s={ticker}", "yahoo_rss"),
    ("https://seekingalpha.com/symbol/{ticker}.xml",      "seekingalpha_rss"),
]

# ── Broad financial feeds (filter by ticker in headline) ─────────────────────
# Note: Reuters removed public RSS in 2020; Benzinga ticker RSS returns 404.
BROAD_FEEDS: list[tuple[str, str]] = [
    ("https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114",    "cnbc_rss"),
    ("https://feeds.marketwatch.com/marketwatch/topstories",                                    "marketwatch_rss"),
    ("https://feeds.content.dowjones.io/public/rss/mw_marketpulse",                            "marketwatch_rss"),
    ("https://www.fool.com/feeds/index.aspx",                                                   "motleyfool_rss"),
    ("https://www.investing.com/rss/news.rss",                                                  "investing_rss"),
    ("https://feeds.a.dj.com/rss/RSSMarketsMain.xml",                                          "wsj_rss"),
]

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (compatible; SentimentSignalBot/1.0; "
        "+https://sentimentsignal.com)"
    )
}


def _parse_date(entry) -> datetime:
    """Best-effort RFC-822 / ISO parse, fallback to now."""
    for attr in ("published", "updated"):
        raw = getattr(entry, attr, None)
        if raw:
            try:
                return parsedate_to_datetime(raw).astimezone(timezone.utc)
            except Exception:
                pass
    return datetime.now(timezone.utc)


def _fetch_feed(url: str) -> list:
    """Download and parse a single RSS/Atom feed. Returns feedparser entries."""
    try:
        resp = requests.get(url, headers=_HEADERS, timeout=10)
        resp.raise_for_status()
        parsed = feedparser.parse(resp.content)
        return parsed.entries or []
    except Exception as e:
        print(f"[rss] fetch error {url}: {e}")
        return []


def _entry_to_dict(entry, source_label: str) -> dict | None:
    """Normalize a feedparser entry into a flat dict."""
    url   = entry.get("link", "")
    title = entry.get("title", "").strip()
    if not url or not title:
        return None
    summary = (entry.get("summary") or entry.get("description") or "").strip() or None
    return {
        "url":     url,
        "title":   title,
        "summary": summary,
        "published_at": _parse_date(entry),
        "source":  source_label,
    }


# ── Public API ────────────────────────────────────────────────────────────────

def fetch_ticker_rss(ticker: str) -> list[dict]:
    """
    Fetch articles from ticker-specific RSS feeds.
    All results are relevant to the ticker by construction.
    """
    results: list[dict] = []
    seen_urls: set[str] = set()

    for url_template, label in TICKER_FEEDS:
        url = url_template.format(ticker=ticker.upper())
        for entry in _fetch_feed(url):
            item = _entry_to_dict(entry, label)
            if item and item["url"] not in seen_urls:
                seen_urls.add(item["url"])
                results.append(item)

    return results


def _ticker_mentioned(text: str, ticker: str) -> bool:
    """
    True if the ticker is meaningfully mentioned in the text.

    Rules:
    - Always accept  $TICKER        e.g. "$V", "$AAPL"
    - Always accept  (TICKER)       e.g. "(V)", "(AAPL)" — standard financial notation
    - Always accept  TICKER:        e.g. "V:" at start of sentence
    - For tickers ≥ 3 chars: also accept whole-word match  e.g. "AAPL"
    - For tickers ≤ 2 chars (V, T …): ONLY the above patterns, not bare letter match
      (the letter "V" appears in almost every English sentence)
    """
    t = ticker.upper()
    text_up = text.upper()

    # $TICKER — standard financial notation
    if f"${t}" in text_up:
        return True

    # (TICKER) — parenthetical form used in most financial headlines
    if f"({t})" in text_up:
        return True

    # TICKER: SPACE — colon-separated headline form e.g. "V: Visa reports earnings"
    # Require whitespace after colon to avoid matching exchange codes like "TSX-V:AEC"
    if re.search(rf"(?<![A-Z\-]){re.escape(t)}:\s", text_up):
        return True

    # For ambiguous short tickers, only the explicit forms above are safe
    if len(t) <= 2:
        return False

    # Longer tickers: whole-word boundary match
    return bool(re.search(rf"\b{re.escape(t)}\b", text_up))


def fetch_broad_rss(ticker: str, company_name: str | None = None,
                    max_per_feed: int = 30) -> list[dict]:
    """
    Fetch articles from general financial RSS feeds.
    Filters to entries that meaningfully mention the ticker or company name.
    """
    results: list[dict] = []
    seen_urls: set[str] = set()

    # Build company-name keywords (first two significant words, e.g. "Visa" from "Visa Inc")
    name_keywords: list[str] = []
    if company_name:
        stopwords = {"inc", "corp", "ltd", "llc", "plc", "co", "group", "holdings", "the"}
        words = [w for w in re.split(r"\W+", company_name.lower()) if w and w not in stopwords]
        name_keywords = [w.upper() for w in words[:2]]

    for url, label in BROAD_FEEDS:
        entries = _fetch_feed(url)
        for entry in entries[:max_per_feed]:
            item = _entry_to_dict(entry, label)
            if not item or item["url"] in seen_urls:
                continue

            text = (item["title"] + " " + (item["summary"] or "")).upper()

            # Accept if ticker is meaningfully present
            if _ticker_mentioned(text, ticker):
                seen_urls.add(item["url"])
                results.append(item)
                continue

            # Accept if a company-name keyword appears as a whole word
            if any(re.search(rf"\b{re.escape(kw)}\b", text) for kw in name_keywords):
                seen_urls.add(item["url"])
                results.append(item)

    return results


def fetch_all_rss(ticker: str, company_name: str | None = None) -> list[dict]:
    """Combine ticker-specific + broad feeds, deduplicated by URL."""
    ticker_articles = fetch_ticker_rss(ticker)
    broad_articles  = fetch_broad_rss(ticker, company_name=company_name)

    seen: set[str] = set()
    combined: list[dict] = []
    for item in ticker_articles + broad_articles:
        if item["url"] not in seen:
            seen.add(item["url"])
            combined.append(item)

    # Sort newest first
    combined.sort(key=lambda x: x["published_at"], reverse=True)
    return combined
