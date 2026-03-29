"""
Core data pipeline: collect → score → analyze → persist.
Called by the scheduler for each tier of stocks.
"""

from datetime import datetime, timezone

from models import db, Stock, Mention, HourlySentiment
from services import reddit_collector, news_collector
from services.sentiment import analyze
from config import Config


def _upsert_mention(stock: Stock, raw: dict, use_finbert: bool) -> None:
    """Insert a new mention or skip if already stored (idempotent by external_id)."""
    if Mention.query.filter_by(external_id=raw["external_id"]).first():
        return

    sentiment = analyze(raw["text"], use_finbert=use_finbert)

    mention = Mention(
        stock_id=stock.id,
        source=raw["source"],
        external_id=raw["external_id"],
        text=raw["text"],
        url=raw.get("url"),
        author=raw.get("author"),
        author_followers=raw.get("author_followers"),
        author_verified=raw.get("author_verified", False),
        author_account_age_days=raw.get("author_account_age_days"),
        author_karma=raw.get("author_karma"),
        upvotes=raw.get("upvotes", 0),
        comments=raw.get("comments", 0),
        subreddit=raw.get("subreddit"),
        news_source=raw.get("news_source"),
        credibility_score=raw["credibility_score"],
        sentiment_score=sentiment["score"],
        sentiment_label=sentiment["label"],
        sentiment_model=sentiment["model"],
        published_at=raw["published_at"],
    )
    db.session.add(mention)


def _compute_aggregated_scores(stock: Stock, since: datetime) -> dict:
    """
    Weighted average sentiment per source for the given time window.
    Weight = credibility_score of each mention.
    """
    mentions = Mention.query.filter(
        Mention.stock_id == stock.id,
        Mention.published_at >= since,
        Mention.sentiment_score.isnot(None),
    ).all()

    def weighted_avg(ms):
        total_weight = sum(m.credibility_score for m in ms)
        if total_weight == 0:
            return None
        return sum(m.sentiment_score * m.credibility_score for m in ms) / total_weight

    reddit_m = [m for m in mentions if m.source == "reddit"]
    twitter_m = [m for m in mentions if m.source == "twitter"]
    news_m = [m for m in mentions if m.source == "news"]

    overall = weighted_avg(mentions)
    return {
        "overall_score": overall,
        "reddit_score": weighted_avg(reddit_m),
        "twitter_score": weighted_avg(twitter_m),
        "news_score": weighted_avg(news_m),
        "reddit_mentions": len(reddit_m),
        "twitter_mentions": len(twitter_m),
        "news_mentions": len(news_m),
    }


def run_for_stock(stock: Stock, hours_back: int = 1) -> None:
    """Full pipeline for a single stock."""
    use_finbert = stock.tier == 1

    # Collect from each source (failures are non-fatal)
    try:
        reddit_raw = reddit_collector.collect_for_ticker(stock.symbol, hours_back=hours_back)
    except Exception as e:
        print(f"[pipeline] Reddit collection failed for {stock.symbol}: {e}")
        reddit_raw = []

    try:
        news_raw = news_collector.collect_for_ticker(stock.symbol, days_back=max(1, hours_back // 24))
    except Exception as e:
        print(f"[pipeline] News collection failed for {stock.symbol}: {e}")
        news_raw = []

    for raw in reddit_raw + news_raw:
        _upsert_mention(stock, raw, use_finbert)

    db.session.commit()

    # Snapshot aggregated sentiment for this hour
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    since = datetime.now(timezone.utc).replace(
        minute=0, second=0, microsecond=0
    )
    scores = _compute_aggregated_scores(stock, since)

    existing = HourlySentiment.query.filter_by(stock_id=stock.id, timestamp=now).first()
    if existing:
        for k, v in scores.items():
            setattr(existing, k, v)
    else:
        snapshot = HourlySentiment(stock_id=stock.id, timestamp=now, **scores)
        db.session.add(snapshot)

    stock.last_scraped_at = datetime.now(timezone.utc)
    db.session.commit()


def run_tier(tier: int, hours_back: int) -> None:
    """Run the pipeline for all stocks of a given tier."""
    stocks = Stock.query.filter_by(tier=tier).all()
    for stock in stocks:
        try:
            run_for_stock(stock, hours_back=hours_back)
        except Exception as e:
            print(f"[pipeline] Error processing {stock.symbol}: {e}")
