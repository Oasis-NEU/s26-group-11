from datetime import date, datetime, timedelta, timezone

from app.extensions import db
from app.db.models import Mention, SourceType
from app.services.news.clients.finnhub import fetch_company_news
from app.services.news.schemas import NewsMentionDTO
from app.services.news.whitelist import score_url


def _finnhub_to_dtos(raw_articles: list[dict], ticker: str) -> list[NewsMentionDTO]:
    """Filter and convert raw Finnhub articles into normalized DTOs."""
    results: list[NewsMentionDTO] = []
    for article in raw_articles:
        url = article.get("url", "")
        if not url:
            continue
        scored = score_url(url)
        if scored is None:
            continue
        domain, credibility = scored

        ts = article.get("datetime", 0)
        published = datetime.fromtimestamp(ts, tz=timezone.utc)

        results.append(
            NewsMentionDTO(
                ticker=ticker.upper(),
                title=article.get("headline", ""),
                summary=article.get("summary") or None,
                url=url,
                source_domain=domain,
                published_at=published,
                credibility_score=credibility,
                raw_provider="finnhub",
            )
        )
    return results


def ingest_news_for_ticker(ticker: str, days: int = 7) -> list[NewsMentionDTO]:
    """Fetch news from Finnhub, filter through whitelist, and insert into DB.

    Returns the list of DTOs that were processed (inserted or already existed).
    """
    to_date = date.today()
    from_date = to_date - timedelta(days=days)

    raw = fetch_company_news(ticker, from_date, to_date)
    dtos = _finnhub_to_dtos(raw, ticker)

    if not dtos:
        return []

    for dto in dtos:
        exists = db.session.query(Mention.id).filter_by(url=dto.url).first()
        if exists:
            continue

        db.session.add(
            Mention(
                ticker=dto.ticker,
                source_type=SourceType.news.value,
                title=dto.title,
                summary=dto.summary,
                url=dto.url,
                source_domain=dto.source_domain,
                published_at=dto.published_at,
                credibility_score=dto.credibility_score,
                raw_provider=dto.raw_provider,
            )
        )

    db.session.commit()
    return dtos


def get_news_for_ticker(
    ticker: str,
    days: int = 7,
    limit: int = 20,
) -> list[Mention]:
    """Read stored news mentions for a ticker from the DB."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    return (
        Mention.query.filter(
            Mention.ticker == ticker.upper(),
            Mention.source_type == SourceType.news.value,
            Mention.published_at >= cutoff,
        )
        .order_by(Mention.published_at.desc())
        .limit(limit)
        .all()
    )
