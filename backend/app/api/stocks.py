from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

import yfinance as yf
from flask import Blueprint, jsonify, request
from sqlalchemy import func

from app.core.cache import get as cache_get, set as cache_set
from app.db.models import Mention, Stock
from app.extensions import db
from app.services.finnhub import get_quote, get_quote_batch, get_fundamentals
from app.services.news.pipeline import get_news_for_ticker, ingest_news_for_ticker
from app.services.sentiment import label as sentiment_label, weighted_aggregate

stocks_bp = Blueprint("stocks", __name__)


def _mention_to_dict(m: Mention) -> dict:
    score = m.sentiment_score
    return {
        "id": m.id,
        "ticker": m.ticker,
        "source": m.source_type,
        "text": m.title,
        "summary": m.summary,
        "url": m.url,
        "author": m.source_domain,
        "author_verified": False,
        "upvotes": m.upvotes or 0,
        "credibility_score": m.credibility_score,
        "sentiment_score": score,
        "sentiment_label": sentiment_label(score) if score is not None else None,
        "news_source": m.source_domain if m.source_type == "news" else None,
        "subreddit": m.subreddit,
        "event_type": m.event_type,
        "event_confidence": m.event_confidence,
        "published_at": m.published_at.isoformat() + "Z",
    }


def _fmt(v, decimals=2):
    try:
        return round(float(v), decimals) if v is not None else None
    except Exception:
        return None


# ─── Feed ────────────────────────────────────────────────────────────────────

_SINCE_MAP = {"1h": 1, "6h": 6, "24h": 24, "7d": 168}

@stocks_bp.route("/feed")
def feed():
    """Recent mentions across all stocks, newest first.
    Optional ?since=1h|6h|24h|7d  (default 7d).
    """
    since = request.args.get("since", "7d")
    hours = _SINCE_MAP.get(since, 168)

    cache_key = f"feed:{since}"
    cached = cache_get(cache_key)
    if cached is not None:
        return jsonify(cached)

    cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=hours)
    mentions = (
        Mention.query
        .filter(Mention.published_at >= cutoff)
        .order_by(Mention.published_at.desc())
        .limit(60)
        .all()
    )
    data = [_mention_to_dict(m) for m in mentions]
    # Cache short windows briefly (1h/6h refresh every 2 min); longer windows 5 min
    ttl = 120 if hours <= 24 else 300
    cache_set(cache_key, data, ttl=ttl)
    return jsonify(data)


# ─── Earnings Calendar ────────────────────────────────────────────────────────

@stocks_bp.route("/earnings")
def earnings():
    """Upcoming earnings dates for the given tickers (default: top trending)."""
    tickers_arg = (request.args.get("tickers") or "").strip()
    tickers = [t.strip().upper() for t in tickers_arg.split(",") if t.strip()]
    if not tickers:
        tr = cache_get("trending")
        tickers = [t["symbol"] for t in (tr or [])[:10]] if tr else []
    if not tickers:
        return jsonify([])

    # Cache key includes the sorted ticker list so different sets don't collide
    cache_key = "earnings:" + ",".join(sorted(tickers))
    cached = cache_get(cache_key)
    if cached is not None:
        return jsonify(cached)

    def fetch_one(symbol: str):
        try:
            obj = yf.Ticker(symbol)
            cal = obj.calendar
            if cal is None:
                return None
            # yfinance ≥ 0.2 returns a dict; older versions return a DataFrame
            if hasattr(cal, "to_dict"):
                # DataFrame: columns are the dates, rows are the fields
                cols = list(cal.columns)
                if cols:
                    d = cols[0]
                    date_str = d.isoformat() if hasattr(d, "isoformat") else str(d)[:10]
                    return {"ticker": symbol, "date": date_str}
            elif isinstance(cal, dict):
                raw = cal.get("Earnings Date") or cal.get("earningsDate")
                if raw is None:
                    return None
                if isinstance(raw, (list, tuple)):
                    raw = raw[0]
                date_str = raw.isoformat() if hasattr(raw, "isoformat") else str(raw)[:10]
                return {"ticker": symbol, "date": date_str}
        except Exception:
            return None

    results = []
    with ThreadPoolExecutor(max_workers=6) as pool:
        for r in pool.map(fetch_one, tickers[:10]):
            if r and r.get("date") and r["date"] not in ("None", "NaT", "nan"):
                results.append(r)

    # Sort ascending by date, keep only future dates
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    results = [r for r in results if r["date"] >= today]
    results.sort(key=lambda r: r["date"])

    cache_set(cache_key, results, ttl=3600)
    return jsonify(results)


# ─── Trending ────────────────────────────────────────────────────────────────

@stocks_bp.route("/trending")
def trending():
    """Top 20 tickers by mention count in the last 72h."""
    cached = cache_get("trending")
    if cached is not None:
        return jsonify(cached)

    cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=72)
    rows = (
        db.session.query(Mention.ticker, func.count(Mention.id).label("mentions"))
        .filter(Mention.published_at >= cutoff)
        .group_by(Mention.ticker)
        .order_by(func.count(Mention.id).desc())
        .limit(20)
        .all()
    )
    tickers = [r[0] for r in rows]

    # Fetch raw sentiment rows for credibility+recency weighted aggregation
    from collections import defaultdict
    sent_raw = (
        db.session.query(
            Mention.ticker,
            Mention.sentiment_score,
            Mention.credibility_score,
            Mention.published_at,
        )
        .filter(
            Mention.ticker.in_(tickers),
            Mention.published_at >= cutoff,
            Mention.sentiment_score.isnot(None),
        )
        .all()
    )
    ticker_items: dict = defaultdict(list)
    for r in sent_raw:
        ticker_items[r.ticker].append((r.sentiment_score, r.credibility_score, r.published_at))
    sentiment_map = {t: weighted_aggregate(v) for t, v in ticker_items.items()}

    # Finnhub batch — parallel, cached per-ticker, sub-100ms per call
    prices = get_quote_batch(tickers)

    # Batch-fetch company names from our Stock table (single query, no N+1)
    stock_names = {
        s.ticker: s.name
        for s in Stock.query.filter(Stock.ticker.in_(tickers)).all()
    }

    results = []
    for ticker, mention_count in rows:
        sent = sentiment_map.get(ticker, {"score": None, "count": 0})
        results.append({
            "ticker": ticker,
            "symbol": ticker,
            "name":          stock_names.get(ticker),
            "mention_count": mention_count,
            "sentiment_score": sent["score"],
            "sentiment_count": sent["count"],
            "sentiment_label": sentiment_label(sent["score"]) if sent["score"] is not None else None,
            "price": prices.get(ticker, {}).get("price"),
            "change_pct": prices.get(ticker, {}).get("change_pct"),
        })
    cache_set("trending", results, ttl=300)
    return jsonify(results)


# ─── Shifters ────────────────────────────────────────────────────────────────

@stocks_bp.route("/shifters")
def shifters():
    """Top 20 tickers with the most new mentions in last 24h vs prior 48h."""
    cached = cache_get("shifters")
    if cached is not None:
        return jsonify(cached)

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    recent_cutoff = now - timedelta(hours=24)
    prior_cutoff  = now - timedelta(hours=72)

    recent = (
        db.session.query(Mention.ticker, func.count(Mention.id).label("cnt"))
        .filter(Mention.published_at >= recent_cutoff)
        .group_by(Mention.ticker)
        .subquery()
    )
    prior = (
        db.session.query(Mention.ticker, func.count(Mention.id).label("cnt"))
        .filter(Mention.published_at >= prior_cutoff, Mention.published_at < recent_cutoff)
        .group_by(Mention.ticker)
        .subquery()
    )

    rows = (
        db.session.query(
            recent.c.ticker,
            recent.c.cnt.label("recent"),
            func.coalesce(prior.c.cnt, 0).label("prior"),
        )
        .outerjoin(prior, recent.c.ticker == prior.c.ticker)
        .order_by((recent.c.cnt - func.coalesce(prior.c.cnt, 0)).desc())
        .limit(20)
        .all()
    )

    tickers = [r[0] for r in rows]

    # Sentiment: weighted recent 24h vs weighted prior 24–72h → delta
    from collections import defaultdict

    def _fetch_weighted(cutoff_start, cutoff_end=None):
        q = (
            db.session.query(
                Mention.ticker, Mention.sentiment_score,
                Mention.credibility_score, Mention.published_at,
            )
            .filter(
                Mention.ticker.in_(tickers),
                Mention.published_at >= cutoff_start,
                Mention.sentiment_score.isnot(None),
            )
        )
        if cutoff_end:
            q = q.filter(Mention.published_at < cutoff_end)
        items: dict = defaultdict(list)
        for r in q.all():
            items[r.ticker].append((r.sentiment_score, r.credibility_score, r.published_at))
        return {t: weighted_aggregate(v) for t, v in items.items()}

    sent_recent_map = _fetch_weighted(recent_cutoff)
    sent_prior_map  = _fetch_weighted(prior_cutoff, cutoff_end=recent_cutoff)

    prices = get_quote_batch(tickers)

    # Batch-fetch company names (single query)
    shifter_names = {
        s.ticker: s.name
        for s in Stock.query.filter(Stock.ticker.in_(tickers)).all()
    }

    results = []
    for ticker, recent_cnt, prior_cnt in rows:
        sr = sent_recent_map.get(ticker, {"score": None, "count": 0})
        sp = sent_prior_map.get(ticker, {"score": None, "count": 0})
        recent_score = sr["score"]
        prior_score  = sp["score"]
        delta = round((recent_score or 0) - (prior_score or 0), 4) if recent_score is not None else 0
        results.append({
            "ticker": ticker,
            "symbol": ticker,
            "name":            shifter_names.get(ticker),
            "recent_mentions": recent_cnt,
            "prior_mentions":  prior_cnt,
            "change": recent_cnt - prior_cnt,
            "sentiment_score":     recent_score,
            "sentiment_count":     sr["count"],
            "sentiment_label":     sentiment_label(recent_score) if recent_score is not None else None,
            "sentiment_delta_24h": delta,
            "price":      prices.get(ticker, {}).get("price"),
            "change_pct": prices.get(ticker, {}).get("change_pct"),
        })
    cache_set("shifters", results, ttl=300)
    return jsonify(results)


# ─── Search ──────────────────────────────────────────────────────────────────

@stocks_bp.route("/search")
def search():
    q_raw = (request.args.get("q") or "").strip()
    if len(q_raw) < 1:
        return jsonify([])

    q_upper = q_raw.upper()
    from app.db.models import Stock
    from app.extensions import db as _db
    from app.services.finnhub import search_symbol

    # 1. DB lookup first — covers our already-ingested universe instantly
    db_results = (
        Stock.query.filter(
            _db.or_(
                Stock.ticker.ilike(f"{q_upper}%"),
                Stock.name.ilike(f"%{q_raw}%"),
            )
        )
        .order_by(
            _db.case((Stock.ticker.ilike(f"{q_upper}%"), 0), else_=1),
            Stock.ticker,
        )
        .limit(5)
        .all()
    )

    seen: set[str] = set()
    results: list[dict] = []

    for s in db_results:
        if s.ticker not in seen:
            seen.add(s.ticker)
            results.append({
                "symbol":   s.ticker,
                "name":     s.name,
                "type":     "Common Stock",
                "exchange": None,
            })

    # 2. Finnhub symbol search fills gaps — handles company-name queries
    #    ("Apple", "Tesla", "nvidia") and tickers not yet in our DB
    if len(results) < 5 and len(q_raw) >= 2:
        try:
            for r in search_symbol(q_raw):
                if r["symbol"] not in seen and len(results) < 8:
                    seen.add(r["symbol"])
                    results.append(r)
        except Exception as e:
            print(f"[search] Finnhub symbol search failed: {e}")

    return jsonify(results)


# ─── Chart (yfinance — history API has no Finnhub free equivalent) ────────────

CHART_PERIODS = {
    "1d": ("1d",  "5m"),
    "1w": ("5d",  "1h"),
    "1m": ("1mo", "1d"),
    "3m": ("3mo", "1d"),
    "1y": ("1y",  "1wk"),
}


@stocks_bp.route("/<ticker>/sentiment-summary")
def sentiment_summary(ticker: str):
    """
    GET /api/stocks/<ticker>/sentiment-summary?days=7
    Returns a rich sentiment narrative for the ticker.
    """
    from collections import Counter

    ticker = ticker.upper()
    days = min(int(request.args.get("days", 7)), 30)

    cache_key = f"sent-summary:{ticker}:{days}"
    cached = cache_get(cache_key)
    if cached is not None:
        return jsonify(cached)

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    mentions = (
        Mention.query
        .filter(Mention.ticker == ticker, Mention.published_at >= cutoff)
        .order_by(Mention.published_at.desc())
        .limit(60)
        .all()
    )

    if not mentions:
        return jsonify({
            "ticker": ticker,
            "overall_score": None,
            "label": "No Data",
            "summary": f"No recent coverage found for {ticker} in the past {days} days.",
            "bullish_pct": 0,
            "bearish_pct": 0,
            "neutral_pct": 0,
            "mention_count": 0,
            "top_events": [],
            "key_headlines": [],
            "sources": {"news": 0, "reddit": 0, "twitter": 0},
        })

    scored = [m for m in mentions if m.sentiment_score is not None]
    bullish = [m for m in scored if m.sentiment_score >= 0.05]
    bearish = [m for m in scored if m.sentiment_score <= -0.05]
    neutral = [m for m in scored if -0.05 < m.sentiment_score < 0.05]
    total_scored = len(scored) or 1

    bullish_pct = round(len(bullish) / total_scored * 100)
    bearish_pct = round(len(bearish) / total_scored * 100)
    neutral_pct = 100 - bullish_pct - bearish_pct

    # Weighted aggregate score
    weighted = weighted_aggregate([
        (m.sentiment_score, m.credibility_score, m.published_at)
        for m in scored
    ])
    overall_score = weighted["score"]
    label = sentiment_label(overall_score) if overall_score is not None else "Neutral"

    # Event tag counts
    event_counter: Counter = Counter()
    for m in mentions:
        if m.event_type:
            event_counter[m.event_type] += 1
    top_events = [
        {"type": et, "count": cnt}
        for et, cnt in event_counter.most_common(3)
    ]

    # Top headlines (most recent, unique, non-empty)
    seen_titles: set = set()
    key_headlines = []
    for m in mentions:
        t = (m.title or "").strip()
        if t and t not in seen_titles:
            seen_titles.add(t)
            key_headlines.append(t)
        if len(key_headlines) >= 3:
            break

    # Source breakdown
    sources: Counter = Counter(m.source_type or "news" for m in mentions)

    # ── Build narrative ──────────────────────────────────────────────────────
    score_str = f"{'+' if (overall_score or 0) >= 0 else ''}{(overall_score or 0):.3f}"
    period_str = f"past {days} day{'s' if days != 1 else ''}"

    # Opening sentence
    if bullish_pct >= 60:
        opening = (
            f"Coverage of {ticker} over the {period_str} is broadly {label.lower()}, "
            f"with {bullish_pct}% of tracked sources signalling bullish momentum."
        )
    elif bearish_pct >= 60:
        opening = (
            f"Coverage of {ticker} over the {period_str} skews {label.lower()}, "
            f"with {bearish_pct}% of tracked sources expressing bearish concern."
        )
    elif abs((overall_score or 0)) < 0.05:
        opening = (
            f"Sentiment on {ticker} over the {period_str} is mixed, "
            f"with no clear directional bias across {len(scored)} scored sources."
        )
    else:
        direction = "tilting bullish" if (overall_score or 0) > 0 else "tilting bearish"
        opening = (
            f"Sentiment on {ticker} over the {period_str} is cautiously {direction} "
            f"({score_str}), with sources divided {bullish_pct}% bullish / {bearish_pct}% bearish."
        )

    # Events sentence
    event_sentence = ""
    if top_events:
        HUMAN_LABELS = {
            "earnings_beat": "Earnings Beat", "earnings_miss": "Earnings Miss",
            "guidance_up": "Guidance Up", "guidance_down": "Guidance Down",
            "fda_approval": "FDA Approval", "fda_rejection": "FDA Rejection",
            "acquisition": "Acquisition", "ceo_change": "CEO Change",
            "layoffs": "Layoffs", "partnership": "Partnership",
            "buyback": "Share Buyback", "ipo": "IPO",
        }
        ev_parts = [
            f"{HUMAN_LABELS.get(e['type'], e['type'])} (×{e['count']})"
            for e in top_events
        ]
        event_sentence = f" Key events flagged: {', '.join(ev_parts)}."

    # Recency sentence
    recency_sentence = ""
    if key_headlines:
        recency_sentence = f" Most recent signal: \"{key_headlines[0][:120]}{'…' if len(key_headlines[0]) > 120 else ''}\"."

    summary = opening + event_sentence + recency_sentence

    result = {
        "ticker": ticker,
        "overall_score": overall_score,
        "label": label,
        "summary": summary,
        "bullish_pct": bullish_pct,
        "bearish_pct": bearish_pct,
        "neutral_pct": neutral_pct,
        "mention_count": len(mentions),
        "scored_count": len(scored),
        "top_events": top_events,
        "key_headlines": key_headlines,
        "sources": {
            "news": sources.get("news", 0),
            "reddit": sources.get("reddit", 0),
            "twitter": sources.get("twitter", 0),
        },
    }
    cache_set(cache_key, result, ttl=300)
    return jsonify(result)


@stocks_bp.route("/<ticker>/reddit-pulse")
def reddit_pulse(ticker: str):
    """
    GET /api/stocks/<ticker>/reddit-pulse
    Returns a structured summary of Reddit sentiment for this ticker.
    """
    from collections import Counter
    ticker = ticker.upper()

    cache_key = f"reddit-pulse:{ticker}"
    cached = cache_get(cache_key)
    if cached is not None:
        return jsonify(cached)

    cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    mentions = (
        Mention.query
        .filter(
            Mention.ticker == ticker,
            Mention.source_type == 'reddit',
            Mention.published_at >= cutoff,
        )
        .order_by(Mention.published_at.desc())
        .limit(60)
        .all()
    )

    if not mentions:
        result = {
            "ticker": ticker,
            "post_count": 0,
            "overall_score": None,
            "label": "No Data",
            "summary": f"No Reddit activity found for {ticker} in the past 7 days.",
            "bullish_pct": 0, "bearish_pct": 0, "neutral_pct": 0,
            "top_posts": [],
            "subreddit_breakdown": {},
        }
        cache_set(cache_key, result, ttl=300)
        return jsonify(result)

    scored = [m for m in mentions if m.sentiment_score is not None]
    bullish = [m for m in scored if m.sentiment_score >= 0.05]
    bearish = [m for m in scored if m.sentiment_score <= -0.05]
    total = len(scored) or 1

    bullish_pct = round(len(bullish) / total * 100)
    bearish_pct = round(len(bearish) / total * 100)
    neutral_pct = 100 - bullish_pct - bearish_pct

    weighted = weighted_aggregate([
        (m.sentiment_score, m.credibility_score, m.published_at)
        for m in scored
    ])
    overall_score = weighted["score"]
    lbl = sentiment_label(overall_score) if overall_score is not None else "Neutral"

    # Top posts sorted by upvotes (most community engagement first)
    top_posts = []
    seen_titles = set()
    for m in sorted(mentions, key=lambda x: (x.upvotes or 0), reverse=True):
        t = (m.title or "").strip()
        if len(t) > 20 and t not in seen_titles:
            seen_titles.add(t)
            score_str = ""
            if m.sentiment_score is not None:
                score_str = f"{'+' if m.sentiment_score >= 0 else ''}{m.sentiment_score:.2f}"
            top_posts.append({
                "title": t[:140],
                "subreddit": m.subreddit or "reddit",
                "url": m.url,
                "upvotes": m.upvotes or 0,
                "sentiment_score": m.sentiment_score,
                "sentiment_label": sentiment_label(m.sentiment_score) if m.sentiment_score is not None else None,
            })
        if len(top_posts) >= 5:
            break

    # Subreddit breakdown
    sub_counter = Counter(m.subreddit or "reddit" for m in mentions)
    subreddit_breakdown = dict(sub_counter.most_common(5))

    # Build narrative
    score_str = f"{'+' if (overall_score or 0) >= 0 else ''}{(overall_score or 0):.3f}"
    post_count = len(mentions)

    if bullish_pct >= 60:
        tone = f"broadly {lbl.lower()}"
    elif bearish_pct >= 60:
        tone = f"predominantly {lbl.lower()}"
    else:
        tone = "mixed"

    top_subs = list(sub_counter.keys())[:3]
    sub_str = ", ".join(f"r/{s}" for s in top_subs)

    summary = (
        f"Reddit sentiment on {ticker} is {tone} ({score_str}) across {post_count} posts "
        f"and comments from {sub_str}. "
        f"{bullish_pct}% of scored posts lean bullish, {bearish_pct}% bearish."
    )

    result = {
        "ticker": ticker,
        "post_count": post_count,
        "overall_score": overall_score,
        "label": lbl,
        "summary": summary,
        "bullish_pct": bullish_pct,
        "bearish_pct": bearish_pct,
        "neutral_pct": neutral_pct,
        "top_posts": top_posts,
        "subreddit_breakdown": subreddit_breakdown,
    }
    cache_set(cache_key, result, ttl=300)
    return jsonify(result)


@stocks_bp.route("/<ticker>/sentiment-history")
def sentiment_history(ticker: str):
    """
    GET /api/stocks/<ticker>/sentiment-history?days=7
    Returns daily sentiment snapshots for trend display.
    """
    import datetime as _dt
    from app.db.models import SentimentSnapshot

    days = min(int(request.args.get("days", 7)), 30)
    ticker = ticker.upper()

    today = _dt.date.today()
    snapshots = (
        SentimentSnapshot.query
        .filter(
            SentimentSnapshot.ticker == ticker,
            SentimentSnapshot.date >= today - _dt.timedelta(days=days - 1),
        )
        .order_by(SentimentSnapshot.date.asc())
        .all()
    )

    # Build a full date range (fill missing days with None)
    date_map = {s.date: s for s in snapshots}
    result = []
    for i in range(days):
        d = today - _dt.timedelta(days=days - 1 - i)
        snap = date_map.get(d)
        result.append({
            "date":            d.isoformat(),
            "score":           snap.score if snap else None,
            "mention_count":   snap.mention_count if snap else 0,
            "avg_credibility": snap.avg_credibility if snap else None,
        })

    return jsonify(result)


@stocks_bp.route("/<ticker>/chart")
def stock_chart(ticker: str):
    ticker = ticker.upper()
    period = request.args.get("period", "1m")
    cache_key = f"chart:{ticker}:{period}"

    cached = cache_get(cache_key)
    if cached is not None:
        return jsonify(cached)

    yf_period, interval = CHART_PERIODS.get(period, ("1mo", "1d"))
    try:
        hist = yf.Ticker(ticker).history(period=yf_period, interval=interval)
        if hist.empty:
            return jsonify([])
        data = [
            {
                "time": ts.isoformat(),
                "close": round(float(row["Close"]), 2),
                "open":  round(float(row["Open"]), 2),
                "high":  round(float(row["High"]), 2),
                "low":   round(float(row["Low"]), 2),
                "volume": int(row["Volume"]),
            }
            for ts, row in hist.iterrows()
        ]
    except Exception as e:
        return jsonify(error=str(e)), 500

    ttl = 60 if period == "1d" else 600
    cache_set(cache_key, data, ttl=ttl)
    return jsonify(data)


# ─── Mentions ────────────────────────────────────────────────────────────────

@stocks_bp.route("/<ticker>/mentions")
def stock_mentions(ticker: str):
    import re as _re

    ticker = ticker.upper()
    source = request.args.get("source")
    days = request.args.get("days", 7, type=int)
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    q = Mention.query.filter(
        Mention.ticker == ticker,
        Mention.published_at >= cutoff,
    )
    if source:
        q = q.filter(Mention.source_type == source)

    # Fetch extra, then deduplicate by normalised title (keep highest credibility)
    rows = q.order_by(Mention.credibility_score.desc(), Mention.published_at.desc()).limit(80).all()

    def _nt(t: str) -> str:
        return _re.sub(r'\W+', ' ', (t or '').lower()).strip()[:120]

    seen: set[str] = set()
    mentions: list[Mention] = []
    for m in rows:
        nt = _nt(m.title)
        if nt not in seen:
            seen.add(nt)
            mentions.append(m)
        if len(mentions) >= 20:
            break

    mentions.sort(key=lambda m: m.published_at, reverse=True)
    return jsonify([_mention_to_dict(m) for m in mentions])


# ─── Stock Detail ─────────────────────────────────────────────────────────────

@stocks_bp.route("/<ticker>")
def stock_detail(ticker: str):
    ticker = ticker.upper()

    # On-demand ingest if no recent data (last 6h)
    cutoff_ingest = datetime.now(timezone.utc) - timedelta(hours=6)
    recent = Mention.query.filter(
        Mention.ticker == ticker,
        Mention.published_at >= cutoff_ingest,
    ).first()
    if not recent:
        try:
            ingest_news_for_ticker(ticker, days=7)
        except Exception as e:
            print(f"[stocks] ingest failed for {ticker}: {e}")

    # Fetch up to 60 for accurate sentiment scoring; display only the 10 most recent
    all_scored_mentions = get_news_for_ticker(ticker, days=7, limit=60)
    mentions = all_scored_mentions[:10]

    # Finnhub quote + fundamentals in parallel — both have their own caches
    with ThreadPoolExecutor(max_workers=2) as pool:
        f_quote = pool.submit(get_quote, ticker)
        f_fund  = pool.submit(get_fundamentals, ticker)
        price_data   = f_quote.result()
        fundamentals = f_fund.result()

    # ── 404 guard: no price from Finnhub + no mentions = ticker doesn't exist ──
    if price_data.get("price") is None and not mentions:
        from app.services.finnhub import search_symbol
        try:
            suggestions = search_symbol(ticker)[:5]
        except Exception:
            suggestions = []
        return jsonify({
            "error":       "ticker_not_found",
            "ticker":      ticker,
            "suggestions": suggestions,
        }), 404

    # Daily mention history — one GROUP BY query, not 7 COUNT()s
    now = datetime.now(timezone.utc)
    window_start = (now - timedelta(days=6)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    rows = (
        db.session.query(
            func.date_trunc("day", Mention.published_at).label("day"),
            func.count(Mention.id).label("cnt"),
        )
        .filter(Mention.ticker == ticker, Mention.published_at >= window_start)
        .group_by(func.date_trunc("day", Mention.published_at))
        .all()
    )
    counts_by_day = {r.day.date(): r.cnt for r in rows}

    history = []
    for days_ago in range(6, -1, -1):
        day = (now - timedelta(days=days_ago)).date()
        history.append({
            "timestamp": datetime.combine(day, datetime.min.time()).isoformat(),
            "overall": None, "reddit": None, "twitter": None, "news": None,
            "mentions": counts_by_day.get(day, 0),
        })

    # Weighted aggregate sentiment (credibility + recency) — use all 60 for accuracy
    weighted = weighted_aggregate([
        (m.sentiment_score, m.credibility_score, m.published_at)
        for m in all_scored_mentions
    ])
    overall_sentiment = weighted["score"]
    sentiment_count   = weighted["count"]

    # Per-day sentiment for the history chart
    sent_rows = (
        db.session.query(
            func.date_trunc("day", Mention.published_at).label("day"),
            func.avg(Mention.sentiment_score).label("avg_sent"),
        )
        .filter(
            Mention.ticker == ticker,
            Mention.published_at >= window_start,
            Mention.sentiment_score.isnot(None),
        )
        .group_by(func.date_trunc("day", Mention.published_at))
        .all()
    )
    sent_by_day = {r.day.date(): round(float(r.avg_sent), 4) for r in sent_rows}

    # Attach daily sentiment to history
    for entry in history:
        day = datetime.fromisoformat(entry["timestamp"]).date()
        entry["news"] = sent_by_day.get(day)
        entry["overall"] = sent_by_day.get(day)

    # Pull name from fundamentals if Finnhub returned it
    name = fundamentals.get("name")

    # Merge fundamentals with intraday OHLC from the quote
    full_fundamentals = {
        "open":     price_data.get("open"),
        "day_high": price_data.get("day_high"),
        "day_low":  price_data.get("day_low"),
        **fundamentals,
    }

    return jsonify({
        "ticker": ticker,
        "symbol": ticker,
        "name": name,
        "price":      price_data.get("price"),
        "change_pct": price_data.get("change_pct"),
        "fundamentals": full_fundamentals,
        "market_cap": fundamentals.get("market_cap"),
        "volume": None,
        "exchange": None,
        "sentiment": {
            "overall": overall_sentiment,
            "news":    overall_sentiment,
            "reddit":  None,
            "twitter": None,
            "sentiment_label": sentiment_label(overall_sentiment) if overall_sentiment is not None else None,
            "reddit_count":  0,
            "twitter_count": 0,
            "news_count": sentiment_count,
        },
        "mention_count": len(all_scored_mentions),
        "history": history,
        "mentions": [_mention_to_dict(m) for m in mentions],
    })
