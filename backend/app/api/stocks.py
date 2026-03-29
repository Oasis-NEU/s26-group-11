from datetime import datetime, timedelta, timezone

import yfinance as yf
from flask import Blueprint, jsonify, request
from sqlalchemy import func

from app.db.models import Mention, SourceType
from app.extensions import db
from app.services.news.pipeline import get_news_for_ticker, ingest_news_for_ticker

stocks_bp = Blueprint("stocks", __name__)


def _mention_to_dict(m: Mention) -> dict:
    return {
        "id": m.id,
        "source": m.source_type,
        "text": m.title,
        "url": m.url,
        "author": m.source_domain,
        "author_verified": False,
        "upvotes": 0,
        "credibility_score": m.credibility_score,
        "sentiment_score": None,
        "sentiment_label": None,
        "news_source": m.source_domain if m.source_type == "news" else None,
        "subreddit": None,
        "published_at": m.published_at.isoformat(),
    }


def _get_price(ticker: str) -> dict:
    try:
        info = yf.Ticker(ticker).fast_info
        return {
            "price": round(info.last_price, 2) if info.last_price else None,
            "change_pct": round(
                (info.last_price - info.previous_close) / info.previous_close * 100, 2
            ) if info.last_price and info.previous_close else None,
        }
    except Exception:
        return {"price": None, "change_pct": None}


@stocks_bp.route("/trending")
def trending():
    """Top 20 tickers by mention count in the last 24h."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    rows = (
        db.session.query(Mention.ticker, func.count(Mention.id).label("mentions"))
        .filter(Mention.published_at >= cutoff)
        .group_by(Mention.ticker)
        .order_by(func.count(Mention.id).desc())
        .limit(20)
        .all()
    )
    results = []
    for ticker, mention_count in rows:
        price_data = _get_price(ticker)
        results.append({"ticker": ticker, "symbol": ticker, "mentions": mention_count, "sentiment_score": None, **price_data})
    return jsonify(results)


@stocks_bp.route("/shifters")
def shifters():
    """Top 20 tickers with the most new mentions in last 6h vs prior 18h."""
    now = datetime.now(timezone.utc)
    recent_cutoff = now - timedelta(hours=6)
    prior_cutoff = now - timedelta(hours=24)

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

    results = []
    for ticker, recent_cnt, prior_cnt in rows:
        price_data = _get_price(ticker)
        results.append({
            "ticker": ticker,
            "symbol": ticker,
            "recent_mentions": recent_cnt,
            "prior_mentions": prior_cnt,
            "change": recent_cnt - prior_cnt,
            "sentiment_delta_24h": 0,
            **price_data,
        })
    return jsonify(results)


@stocks_bp.route("/search")
def search():
    q = (request.args.get("q") or "").strip().upper()
    if len(q) < 1:
        return jsonify([])

    # First: search DB for known tickers (fast)
    from app.db.models import Stock
    db_results = (
        Stock.query.filter(Stock.ticker.like(f"{q}%"))
        .order_by(Stock.ticker)
        .limit(8)
        .all()
    )
    if db_results:
        return jsonify([{"symbol": s.ticker, "name": s.name} for s in db_results])

    # Fallback: yfinance for unknown tickers
    try:
        info = yf.Ticker(q).fast_info
        if info.last_price:
            return jsonify([{"symbol": q, "name": q}])
    except Exception:
        pass
    return jsonify([])


@stocks_bp.route("/<ticker>/mentions")
def stock_mentions(ticker: str):
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
    mentions = q.order_by(Mention.published_at.desc()).limit(20).all()
    return jsonify([_mention_to_dict(m) for m in mentions])


@stocks_bp.route("/<ticker>")
def stock_detail(ticker: str):
    ticker = ticker.upper()

    # Trigger on-demand ingest if no recent data (last 6h)
    cutoff = datetime.now(timezone.utc) - timedelta(hours=6)
    recent = Mention.query.filter(
        Mention.ticker == ticker,
        Mention.published_at >= cutoff,
    ).first()

    if not recent:
        try:
            ingest_news_for_ticker(ticker, days=7)
        except Exception as e:
            print(f"[stocks] ingest failed for {ticker}: {e}")

    mentions = get_news_for_ticker(ticker, days=7, limit=10)
    price_data = _get_price(ticker)

    # 7-day daily history in shape StockDetail.history expects
    history = []
    for days_ago in range(6, -1, -1):
        day_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=days_ago)
        day_end = day_start + timedelta(days=1)
        count = Mention.query.filter(
            Mention.ticker == ticker,
            Mention.published_at >= day_start,
            Mention.published_at < day_end,
        ).count()
        history.append({
            "timestamp": day_start.isoformat(),
            "overall": None,
            "reddit": None,
            "twitter": None,
            "news": None,
            "mentions": count,
        })

    return jsonify({
        "ticker": ticker,
        "symbol": ticker,
        "name": None,
        **price_data,
        "market_cap": None,
        "volume": None,
        "exchange": None,
        "sentiment": {
            "overall": None,
            "reddit": None,
            "twitter": None,
            "news": None,
            "reddit_count": 0,
            "twitter_count": 0,
            "news_count": len(mentions),
        },
        "mention_count": len(mentions),
        "history": history,
        "mentions": [_mention_to_dict(m) for m in mentions],
    })
