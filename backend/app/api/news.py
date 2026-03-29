from flask import Blueprint, jsonify, request

from app.core import config
from app.services.news.pipeline import get_news_for_ticker, ingest_news_for_ticker

news_bp = Blueprint("news", __name__)


@news_bp.route("/internal/news/ingest/<ticker>", methods=["POST"])
def ingest_news(ticker):
    api_key = request.headers.get("X-Api-Key", "")
    if api_key != config.INTERNAL_API_KEY:
        return jsonify(detail="Invalid API key"), 403

    dtos = ingest_news_for_ticker(ticker)
    return jsonify(ticker=ticker.upper(), ingested=len(dtos))


@news_bp.route("/stocks/<ticker>/news")
def get_stock_news(ticker):
    days = request.args.get("days", 7, type=int)
    limit = request.args.get("limit", 20, type=int)
    days = max(1, min(30, days))
    limit = max(1, min(100, limit))

    mentions = get_news_for_ticker(ticker, days=days, limit=limit)
    return jsonify(
        [
            {
                "ticker": m.ticker,
                "title": m.title,
                "summary": m.summary,
                "url": m.url,
                "source_domain": m.source_domain,
                "published_at": m.published_at.isoformat(),
                "credibility_score": m.credibility_score,
                "raw_provider": m.raw_provider,
            }
            for m in mentions
        ]
    )
