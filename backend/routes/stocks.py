"""
Stock-related API endpoints.

GET /api/stocks/trending          — top 20 most-discussed
GET /api/stocks/shifters          — biggest 24h sentiment change
GET /api/stocks/search?q=         — ticker autocomplete
GET /api/stocks/<symbol>          — stock detail + sentiment
GET /api/stocks/<symbol>/mentions — filtered high-credibility mentions
"""

from datetime import datetime, timezone, timedelta

from flask import Blueprint, jsonify, request, current_app
from flask_caching import Cache

from models import db, Stock, HourlySentiment, Mention
from services.stock_data import get_stock_info, search_tickers
from jobs.pipeline import run_for_stock

stocks_bp = Blueprint("stocks", __name__, url_prefix="/api/stocks")
cache = Cache()


def _attach_cache(app):
    cache.init_app(app)


# ---------------------------------------------------------------------------
# Trending
# ---------------------------------------------------------------------------

@stocks_bp.get("/trending")
@cache.cached(timeout=3600, key_prefix="trending")
def trending():
    """Top 20 stocks by total credible mention count in last 24h."""
    since = datetime.now(timezone.utc) - timedelta(hours=24)

    rows = (
        db.session.query(
            Stock,
            db.func.count(Mention.id).label("mention_count"),
            db.func.avg(Mention.sentiment_score).label("avg_sentiment"),
        )
        .join(Mention, Mention.stock_id == Stock.id)
        .filter(Mention.published_at >= since)
        .group_by(Stock.id)
        .order_by(db.desc("mention_count"))
        .limit(20)
        .all()
    )

    result = []
    for stock, mention_count, avg_sentiment in rows:
        info = get_stock_info(stock.symbol) or {}
        result.append({
            **stock.to_dict(),
            "mention_count": mention_count,
            "sentiment_score": round(avg_sentiment or 0, 4),
            "price": info.get("price"),
            "change_pct": info.get("change_pct"),
        })

    return jsonify(result)


# ---------------------------------------------------------------------------
# Sentiment shifters
# ---------------------------------------------------------------------------

@stocks_bp.get("/shifters")
@cache.cached(timeout=3600, key_prefix="shifters")
def shifters():
    """Stocks with the biggest absolute sentiment change in last 24h."""
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    yesterday = now - timedelta(hours=24)

    current_rows = (
        db.session.query(Stock, HourlySentiment)
        .join(HourlySentiment, HourlySentiment.stock_id == Stock.id)
        .filter(HourlySentiment.timestamp == now)
        .all()
    )
    prev_rows = (
        db.session.query(Stock.id, HourlySentiment.overall_score)
        .join(HourlySentiment, HourlySentiment.stock_id == Stock.id)
        .filter(HourlySentiment.timestamp == yesterday)
        .all()
    )
    prev_by_id = {row[0]: row[1] for row in prev_rows}

    shifts = []
    for stock, current_snap in current_rows:
        prev_score = prev_by_id.get(stock.id)
        if prev_score is None or current_snap.overall_score is None:
            continue
        delta = current_snap.overall_score - prev_score
        shifts.append((stock, current_snap, delta))

    shifts.sort(key=lambda x: abs(x[2]), reverse=True)

    result = []
    for stock, snap, delta in shifts[:20]:
        info = get_stock_info(stock.symbol) or {}
        result.append({
            **stock.to_dict(),
            "sentiment_score": snap.overall_score,
            "sentiment_delta_24h": round(delta, 4),
            "price": info.get("price"),
            "change_pct": info.get("change_pct"),
        })

    return jsonify(result)


# ---------------------------------------------------------------------------
# Search / autocomplete
# ---------------------------------------------------------------------------

@stocks_bp.get("/search")
def search():
    q = request.args.get("q", "").strip().upper()
    if len(q) < 1:
        return jsonify([])

    results = search_tickers(q, limit=10)
    return jsonify(results)


# ---------------------------------------------------------------------------
# Stock detail
# ---------------------------------------------------------------------------

@stocks_bp.get("/<symbol>")
def stock_detail(symbol: str):
    symbol = symbol.upper()

    stock = Stock.query.filter_by(symbol=symbol).first()

    # On-demand scrape for long-tail stocks
    if stock is None:
        stock = Stock(symbol=symbol, tier=3)
        db.session.add(stock)
        db.session.commit()

    needs_refresh = (
        stock.last_scraped_at is None
        or (datetime.now(timezone.utc) - stock.last_scraped_at).total_seconds() > 3600
    )

    if needs_refresh:
        try:
            run_for_stock(stock, hours_back=24)
        except Exception as e:
            current_app.logger.warning(f"On-demand scrape failed for {symbol}: {e}")

    # Price data
    info = get_stock_info(symbol) or {}

    # 7-day hourly sentiment history
    since_7d = datetime.now(timezone.utc) - timedelta(days=7)
    history = (
        HourlySentiment.query
        .filter_by(stock_id=stock.id)
        .filter(HourlySentiment.timestamp >= since_7d)
        .order_by(HourlySentiment.timestamp)
        .all()
    )

    # Current sentiment (latest snapshot)
    latest = history[-1] if history else None

    return jsonify({
        **stock.to_dict(),
        **info,
        "sentiment": {
            "overall": latest.overall_score if latest else None,
            "reddit": latest.reddit_score if latest else None,
            "twitter": latest.twitter_score if latest else None,
            "news": latest.news_score if latest else None,
            "reddit_count": latest.reddit_mentions if latest else 0,
            "twitter_count": latest.twitter_mentions if latest else 0,
            "news_count": latest.news_mentions if latest else 0,
        },
        "history": [
            {
                "timestamp": h.timestamp.isoformat(),
                "overall": h.overall_score,
                "reddit": h.reddit_score,
                "twitter": h.twitter_score,
                "news": h.news_score,
            }
            for h in history
        ],
    })


# ---------------------------------------------------------------------------
# Mentions feed
# ---------------------------------------------------------------------------

@stocks_bp.get("/<symbol>/mentions")
def stock_mentions(symbol: str):
    symbol = symbol.upper()
    source = request.args.get("source")       # "reddit" | "twitter" | "news" | None

    stock = Stock.query.filter_by(symbol=symbol).first()
    if not stock:
        return jsonify([])

    since = datetime.now(timezone.utc) - timedelta(days=7)
    query = (
        Mention.query
        .filter_by(stock_id=stock.id)
        .filter(Mention.published_at >= since)
        .order_by(Mention.credibility_score.desc(), Mention.published_at.desc())
    )

    if source:
        query = query.filter_by(source=source)

    mentions = query.limit(20).all()
    return jsonify([m.to_dict() for m in mentions])
