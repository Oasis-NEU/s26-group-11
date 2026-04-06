"""
Finnhub API client.
Replaces yfinance for all real-time price and fundamental data.
- Sub-100ms per quote (vs 500ms–2s for yfinance)
- Proper REST API (no scraping, no flakiness)
- Free tier: 60 req/min — well within budget with our backend cache
"""
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests

from app.core import config
from app.core.cache import get as cache_get, set as cache_set

_BASE = "https://finnhub.io/api/v1"


def _get(path: str, params: dict | None = None) -> dict | None:
    """Make a single Finnhub API call. Returns None on any error."""
    try:
        resp = requests.get(
            f"{_BASE}{path}",
            params={**(params or {}), "token": config.FINNHUB_API_KEY},
            timeout=5,
        )
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        print(f"[finnhub] {path} error: {e}")
        return None


# ─── Quote ───────────────────────────────────────────────────────────────────

def get_quote(ticker: str) -> dict:
    """
    Fetch current price + day change% for one ticker.
    Cached for 60 s — fresh enough for live tiles without hammering the API.
    """
    cache_key = f"fh:quote:{ticker}"
    hit = cache_get(cache_key)
    if hit is not None:
        return hit

    data = _get("/quote", {"symbol": ticker})
    if not data or not data.get("c"):
        result = {"price": None, "change_pct": None,
                  "open": None, "day_high": None, "day_low": None,
                  "prev_close": None}
    else:
        result = {
            "price":      round(float(data["c"]), 2),
            "change_pct": round(float(data["dp"]), 2),
            "open":       round(float(data["o"]), 2) if data.get("o") else None,
            "day_high":   round(float(data["h"]), 2) if data.get("h") else None,
            "day_low":    round(float(data["l"]), 2) if data.get("l") else None,
            "prev_close": round(float(data["pc"]), 2) if data.get("pc") else None,
        }

    cache_set(cache_key, result, ttl=60)
    return result


def get_quote_batch(tickers: list[str]) -> dict[str, dict]:
    """
    Fetch quotes for multiple tickers in parallel.
    Cache hits are returned immediately; misses are fetched concurrently.
    """
    results: dict[str, dict] = {}
    to_fetch: list[str] = []

    for t in tickers:
        hit = cache_get(f"fh:quote:{t}")
        if hit is not None:
            results[t] = hit
        else:
            to_fetch.append(t)

    if to_fetch:
        with ThreadPoolExecutor(max_workers=min(len(to_fetch), 10)) as pool:
            futures = {pool.submit(get_quote, t): t for t in to_fetch}
            for future in as_completed(futures):
                t = futures[future]
                try:
                    results[t] = future.result()
                except Exception:
                    results[t] = {"price": None, "change_pct": None}

    return results


# ─── Fundamentals ────────────────────────────────────────────────────────────

def get_fundamentals(ticker: str) -> dict:
    """
    Fetch key financial metrics + company profile.
    Cached for 1 h — fundamentals change at most daily.
    Uses two parallel Finnhub calls: /stock/metric + /stock/profile2.
    """
    cache_key = f"fh:fundamentals:{ticker}"
    hit = cache_get(cache_key)
    if hit is not None:
        return hit

    # Fire both calls in parallel
    with ThreadPoolExecutor(max_workers=2) as pool:
        f_metric  = pool.submit(_get, "/stock/metric",   {"symbol": ticker, "metric": "all"})
        f_profile = pool.submit(_get, "/stock/profile2", {"symbol": ticker})
        metric_data  = f_metric.result()
        profile_data = f_profile.result()

    result: dict = {}

    if metric_data and metric_data.get("metric"):
        m = metric_data["metric"]
        result.update({
            "pe_ratio":          _safe_float(m.get("peNormalizedAnnual")),
            "eps":               _safe_float(m.get("epsNormalizedAnnual")),
            "beta":              _safe_float(m.get("beta")),
            "dividend_yield":    _safe_float(m.get("dividendYieldIndicatedAnnual")),
            "fifty_two_week_high": _safe_float(m.get("52WeekHigh")),
            "fifty_two_week_low":  _safe_float(m.get("52WeekLow")),
            # Finnhub returns avg volume in millions
            "avg_volume": int(m["10DayAverageTradingVolume"] * 1_000_000)
                          if m.get("10DayAverageTradingVolume") else None,
        })

    if profile_data:
        # marketCapitalization is in millions
        mc = profile_data.get("marketCapitalization")
        result["market_cap"] = int(mc * 1_000_000) if mc else None
        result.setdefault("name", profile_data.get("name"))

    cache_set(cache_key, result, ttl=3600)
    return result


def search_symbol(query: str) -> list[dict]:
    """
    Search for stocks/ETFs by ticker or company name.
    Uses Finnhub /search endpoint.
    Returns up to 8 results: [{"symbol", "name", "type", "exchange"}]
    Cached for 5 min — search results are stable.
    """
    cache_key = f"fh:search:{query.lower().strip()}"
    hit = cache_get(cache_key)
    if hit is not None:
        return hit

    data = _get("/search", {"q": query})
    if not data or not data.get("result"):
        cache_set(cache_key, [], ttl=300)
        return []

    # Block types we never want to show
    BLOCKED_TYPES = {"Currency", "Cryptocurrency", "Mutual Fund", "Bond", "Index"}

    def _to_result(item: dict) -> dict | None:
        symbol = (item.get("displaySymbol") or item.get("symbol") or "").strip()
        type_  = item.get("type", "")
        if not symbol or type_ in BLOCKED_TYPES:
            return None
        name_raw = item.get("description") or ""
        name = name_raw.title() if name_raw.isupper() else name_raw
        return {"symbol": symbol, "name": name, "type": type_, "exchange": ""}

    all_items = data["result"]

    # Pass 1 — US/OTC listings only (no exchange suffix dot)
    results: list[dict] = []
    seen: set[str] = set()
    for item in all_items:
        r = _to_result(item)
        if r and "." not in r["symbol"] and r["symbol"] not in seen:
            seen.add(r["symbol"])
            results.append(r)
            if len(results) >= 6:
                break

    # Pass 2 — backfill with foreign primaries if US results are sparse (< 2)
    # e.g. "nintendo" → only 7974.T; "samsung" → 005930.KS etc.
    if len(results) < 2:
        for item in all_items:
            r = _to_result(item)
            if r and r["symbol"] not in seen:
                base = r["symbol"].split(".")[0]
                if base not in seen:
                    seen.add(r["symbol"])
                    seen.add(base)
                    results.append(r)
                    if len(results) >= 5:
                        break

    cache_set(cache_key, results, ttl=300)
    return results


def _safe_float(v, decimals: int = 2):
    try:
        return round(float(v), decimals) if v is not None else None
    except Exception:
        return None
