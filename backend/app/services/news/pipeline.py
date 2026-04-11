"""
News ingestion pipeline — multi-source.

Sources (all run in parallel per-ticker):
  1. Finnhub /company-news
  2. RSS feeds
  3. NewsAPI /everything
  4. Reddit (optional — requires REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET)

Scoring:
  - FinBERT (or VADER fallback) for sentiment
  - Rule-based event tagger for structured event types
  - Articles scored in batch for efficiency
"""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, timedelta, timezone

from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.db.models import Mention, SourceType
from app.extensions import db
from app.services.finbert import score_batch
from app.services.event_tagger import tag_event
from app.services.news.clients.finnhub import fetch_company_news
from app.services.news.clients.rss import fetch_all_rss, _ticker_mentioned
from app.services.news.clients.newsapi import search_news, NewsAPIBudgetExceeded
from app.services.news.clients.reddit import fetch_reddit_mentions
from app.services.news.schemas import NewsMentionDTO
from app.services.news.whitelist import score_url, score_source

# Reddit credibility score (community source — below Tier 3 press)
_REDDIT_CREDIBILITY = 45


# ── Converters (batch-scored) ─────────────────────────────────────────────────

def _finnhub_to_dtos(raw: list[dict], ticker: str) -> list[NewsMentionDTO]:
    articles = []
    for article in raw:
        url = article.get("url", "")
        if not url:
            continue
        scored = score_url(url) or score_source(article.get("source", ""))
        if scored is None:
            continue
        domain, credibility = scored
        ts        = article.get("datetime", 0)
        published = datetime.fromtimestamp(ts, tz=timezone.utc)
        title     = article.get("headline", "")
        summary   = article.get("summary") or None
        ev_type, ev_conf = tag_event(title, summary)
        articles.append({
            "ticker": ticker.upper(), "title": title, "summary": summary,
            "url": url, "domain": domain, "published": published,
            "credibility": credibility, "event_type": ev_type,
            "event_confidence": ev_conf, "source_type": SourceType.news.value,
            "subreddit": None,
        })

    if not articles:
        return []

    texts  = [f"{a['title']}. {a['title']}. {a['summary'] or ''}" for a in articles]
    scores = score_batch(texts)

    return [NewsMentionDTO(
        ticker=a["ticker"], title=a["title"], summary=a["summary"],
        url=a["url"], source_domain=a["domain"], published_at=a["published"],
        credibility_score=a["credibility"], sentiment_score=scores[i],
        raw_provider="finnhub", event_type=a["event_type"],
        event_confidence=a["event_confidence"], source_type=a["source_type"],
    ) for i, a in enumerate(articles)]


def _rss_to_dtos(raw: list[dict], ticker: str) -> list[NewsMentionDTO]:
    articles = []
    for article in raw:
        url = article.get("url", "")
        if not url:
            continue
        scored = score_url(url)
        if scored is None:
            continue
        domain, credibility = scored
        title   = article.get("title", "")
        summary = article.get("summary") or None
        ev_type, ev_conf = tag_event(title, summary)
        articles.append({
            "ticker": ticker.upper(), "title": title, "summary": summary,
            "url": url, "domain": domain,
            "published": article.get("published_at", datetime.now(timezone.utc)),
            "credibility": credibility, "event_type": ev_type,
            "event_confidence": ev_conf, "source_type": SourceType.news.value,
        })

    if not articles:
        return []

    texts  = [f"{a['title']}. {a['title']}. {a['summary'] or ''}" for a in articles]
    scores = score_batch(texts)

    return [NewsMentionDTO(
        ticker=a["ticker"], title=a["title"], summary=a["summary"],
        url=a["url"], source_domain=a["domain"], published_at=a["published"],
        credibility_score=a["credibility"], sentiment_score=scores[i],
        raw_provider="rss", event_type=a["event_type"],
        event_confidence=a["event_confidence"], source_type=a["source_type"],
    ) for i, a in enumerate(articles)]


def _newsapi_to_dtos(raw: list[dict], ticker: str) -> list[NewsMentionDTO]:
    articles = []
    for article in raw:
        url = article.get("url", "")
        if not url:
            continue
        scored = score_url(url)
        if scored is None:
            continue
        domain, credibility = scored
        raw_date = article.get("publishedAt", "")
        try:
            published = datetime.fromisoformat(raw_date.replace("Z", "+00:00"))
        except Exception:
            published = datetime.now(timezone.utc)
        title   = article.get("title") or ""
        summary = article.get("description") or None
        ev_type, ev_conf = tag_event(title, summary)
        articles.append({
            "ticker": ticker.upper(), "title": title, "summary": summary,
            "url": url, "domain": domain, "published": published,
            "credibility": credibility, "event_type": ev_type,
            "event_confidence": ev_conf, "source_type": SourceType.news.value,
        })

    if not articles:
        return []

    texts  = [f"{a['title']}. {a['title']}. {a['summary'] or ''}" for a in articles]
    scores = score_batch(texts)

    return [NewsMentionDTO(
        ticker=a["ticker"], title=a["title"], summary=a["summary"],
        url=a["url"], source_domain=a["domain"], published_at=a["published"],
        credibility_score=a["credibility"], sentiment_score=scores[i],
        raw_provider="newsapi", event_type=a["event_type"],
        event_confidence=a["event_confidence"], source_type=a["source_type"],
    ) for i, a in enumerate(articles)]


_REDDIT_COMMENT_CREDIBILITY = 35


def _reddit_to_dtos(raw: list[dict], ticker: str) -> list[NewsMentionDTO]:
    articles = []
    for post in raw:
        url   = post.get("url", "")
        title = post.get("title", "")
        if not url or not title:
            continue
        is_comment = bool(post.get("is_comment", False))
        credibility = _REDDIT_COMMENT_CREDIBILITY if is_comment else _REDDIT_CREDIBILITY
        ev_type, ev_conf = tag_event(title, post.get("summary"))
        articles.append({
            "ticker": ticker.upper(), "title": title,
            "summary": post.get("summary"), "url": url,
            "domain": post.get("source_domain", "reddit.com"),
            "published": post.get("published_at", datetime.now(timezone.utc)),
            "credibility": credibility,
            "upvotes": int(post.get("upvotes", 0)),
            "event_type": ev_type, "event_confidence": ev_conf,
            "source_type": SourceType.reddit.value,
            "subreddit": post.get("subreddit"),
        })

    if not articles:
        return []

    texts  = [f"{a['title']}. {a['title']}. {a['summary'] or ''}" for a in articles]
    scores = score_batch(texts)

    return [NewsMentionDTO(
        ticker=a["ticker"], title=a["title"], summary=a["summary"],
        url=a["url"], source_domain=a["domain"], published_at=a["published"],
        credibility_score=a["credibility"], sentiment_score=scores[i],
        raw_provider="reddit", event_type=a["event_type"],
        event_confidence=a["event_confidence"],
        source_type=a["source_type"], subreddit=a["subreddit"],
        upvotes=a["upvotes"],
    ) for i, a in enumerate(articles)]


# ── Core ingestion ────────────────────────────────────────────────────────────

def _company_name_for(ticker: str) -> str | None:
    """Look up the stored company name for a ticker (single cached query)."""
    try:
        from app.db.models import Stock
        s = Stock.query.filter_by(ticker=ticker).first()
        return s.name if s and s.name else None
    except Exception:
        return None


_FINANCE_KEYWORDS = {
    "stock", "share", "shares", "market", "earnings", "revenue", "profit",
    "loss", "dividend", "investor", "investing", "investment", "portfolio",
    "trade", "trading", "price", "valuation", "ipo", "sec", "nasdaq", "nyse",
    "s&p", "dow", "bull", "bear", "rally", "selloff", "sell-off", "quarter",
    "guidance", "forecast", "analyst", "upgrade", "downgrade", "buy", "sell",
    "hold", "target", "eps", "pe ratio", "hedge", "fund", "etf", "bond",
    "yield", "interest rate", "fed", "inflation", "gdp", "economy", "economic",
    "acquisition", "merger", "buyback", "ipo", "ceo", "cfo", "coo", "exec",
    "layoff", "lawsuit", "regulation", "fine", "penalty", "bankruptcy",
    "debt", "cash flow", "balance sheet", "income statement", "fiscal",
}

_NOISE_TITLES = {
    "video!", "watch:", "highlights", "fight", "game", "score", "goal",
    "tournament", "championship", "vs.", "vs ", "ufc", "nfl", "nba", "nhl",
    "mlb", "soccer", "football", "basketball", "baseball", "hockey",
    "wrestling", "boxing", "mma", "kick", "punch", "knockout",
}


def _is_relevant(title: str, summary: str | None, ticker: str,
                 company_name: str | None) -> bool:
    """
    True if the article is plausibly about this company AND has financial context.
    Used as a last-resort gate before persisting any article from any source.

    Design:
    - Explicit ticker notation ($TICKER / (TICKER)) anywhere is always a strong
      signal and accepted immediately regardless of where it appears.
    - Otherwise the ticker or company name MUST appear in the TITLE (not buried
      in the summary) to avoid tangential mentions counting as categorisation.
    - Company-name keywords shorter than 5 chars (e.g. "KEY", "ACE", "MO") are
      skipped because they match too many unrelated English words.
    """
    import re as _re
    title_up = title.upper()
    text     = (title + " " + (summary or "")).upper()
    t        = ticker.upper()
    title_lower = title.lower()

    # Hard reject: obvious sports/entertainment noise titles
    for noise in _NOISE_TITLES:
        if noise in title_lower:
            return False

    # Explicit notation anywhere → accept, UNLESS this is a multi-ticker post
    # (e.g. "$SPY $AMZN $AAPL $META $MU ..." — not useful signal for any one stock).
    if f"${t}" in text or f"({t})" in text:
        unique_tickers = len(_re.findall(r'\$[A-Z]{1,6}', text))
        if unique_tickers >= 4:
            return False   # multi-ticker noise
        return True

    # Must have at least one finance keyword in the combined text
    if not any(kw in text.lower() for kw in _FINANCE_KEYWORDS):
        return False

    # Ticker must be present in the TITLE (not just the summary)
    if _ticker_mentioned(title_up, t):
        return True

    # Company name check: keyword must be in the TITLE and ≥ 5 chars
    # (short words like "key", "ace", "real" are too ambiguous)
    if company_name:
        stopwords = {"inc", "corp", "ltd", "llc", "plc", "co", "group",
                     "holdings", "the", "and", "&"}
        words = [w for w in _re.split(r"\W+", company_name.lower())
                 if w and w not in stopwords and len(w) >= 5]
        for kw in words[:2]:
            if _re.search(rf"\b{_re.escape(kw.upper())}\b", title_up):
                return True

    return False


def ingest_news_for_ticker(ticker: str, days: int = 7) -> list[NewsMentionDTO]:
    ticker    = ticker.upper()
    to_date   = date.today()
    from_date = to_date - timedelta(days=days)

    # Look up company name once — used for relevance filtering
    company_name = _company_name_for(ticker)

    all_dtos: list[NewsMentionDTO] = []

    def _run_finnhub():
        raw = fetch_company_news(ticker, from_date, to_date)
        return _finnhub_to_dtos(raw, ticker)

    def _run_rss():
        raw = fetch_all_rss(ticker, company_name=company_name)
        return _rss_to_dtos(raw, ticker)

    def _run_newsapi():
        try:
            # Always prefer quoted company name over bare ticker symbol to avoid
            # matching common English words (e.g. "COST" → "cost reduction" noise).
            query = f'"{company_name}"' if company_name else ticker
            raw = search_news(query=query, from_date=from_date,
                              to_date=to_date, page_size=30)
            return _newsapi_to_dtos(raw, ticker)
        except NewsAPIBudgetExceeded as e:
            print(f"[pipeline] NewsAPI budget exceeded: {e}")
            return []
        except Exception as e:
            print(f"[pipeline] NewsAPI error: {e}")
            return []

    def _run_reddit():
        raw = fetch_reddit_mentions(ticker)
        return _reddit_to_dtos(raw, ticker)

    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = {
            pool.submit(_run_finnhub): "finnhub",
            pool.submit(_run_rss):     "rss",
            pool.submit(_run_newsapi): "newsapi",
            pool.submit(_run_reddit):  "reddit",
        }
        for future in as_completed(futures):
            source = futures[future]
            try:
                dtos = future.result()
                print(f"[pipeline] {source}: {len(dtos)} articles for {ticker}")
                all_dtos.extend(dtos)
            except Exception as e:
                print(f"[pipeline] {source} failed: {e}")

    if not all_dtos:
        return []

    import re as _re

    def _norm_title(t: str) -> str:
        """Normalise a headline for dedup: lowercase, strip punctuation/spaces."""
        return _re.sub(r'\W+', ' ', (t or '').lower()).strip()[:120]

    # Deduplicate by URL + title + relevance gate
    # When the same story appears at multiple URLs (e.g. yahoo.com vs finance.yahoo.com),
    # keep the highest-credibility version; otherwise keep first seen.
    seen_urls:   set[str] = set()
    seen_titles: dict[str, NewsMentionDTO] = {}   # norm_title -> best dto so far
    dropped = 0

    # Sort by credibility desc so we naturally keep the best source on first encounter
    all_dtos.sort(key=lambda d: d.credibility_score, reverse=True)

    for dto in all_dtos:
        if dto.url in seen_urls:
            continue
        if not _is_relevant(dto.title, dto.summary, ticker, company_name):
            dropped += 1
            continue
        nt = _norm_title(dto.title)
        if nt in seen_titles:
            # Already have this story — skip lower-credibility duplicate
            continue
        seen_urls.add(dto.url)
        seen_titles[nt] = dto

    unique_dtos = list(seen_titles.values())
    if dropped:
        print(f"[pipeline] {ticker}: dropped {dropped} irrelevant articles")
    dupe_count = len(all_dtos) - dropped - len(unique_dtos)
    if dupe_count > 0:
        print(f"[pipeline] {ticker}: collapsed {dupe_count} duplicate titles")

    # Upsert — ignore if URL already exists
    for dto in unique_dtos:
        stmt = pg_insert(Mention).values(
            ticker=dto.ticker,
            source_type=dto.source_type,
            title=dto.title,
            summary=dto.summary,
            url=dto.url,
            source_domain=dto.source_domain,
            published_at=dto.published_at,
            credibility_score=dto.credibility_score,
            sentiment_score=dto.sentiment_score,
            raw_provider=dto.raw_provider,
            event_type=dto.event_type,
            event_confidence=dto.event_confidence,
            subreddit=dto.subreddit,
            upvotes=dto.upvotes,
        ).on_conflict_do_nothing()   # covers both url AND (ticker, md5(title)) unique indexes
        db.session.execute(stmt)

    db.session.commit()
    print(f"[pipeline] {ticker}: inserted up to {len(unique_dtos)} articles "
          f"from {len(all_dtos)} total (dupes dropped)")
    return unique_dtos


def get_news_for_ticker(
    ticker: str,
    days: int = 7,
    limit: int = 20,
) -> list[Mention]:
    import re as _re

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    # Fetch extra to account for title-level dedup
    rows = (
        Mention.query
        .filter(
            Mention.ticker == ticker.upper(),
            Mention.published_at >= cutoff,
        )
        .order_by(Mention.credibility_score.desc(), Mention.published_at.desc())
        .limit(limit * 4)
        .all()
    )

    # Deduplicate by normalised title, keeping highest-credibility version
    def _nt(t: str) -> str:
        return _re.sub(r'\W+', ' ', (t or '').lower()).strip()[:120]

    seen: set[str] = set()
    unique: list[Mention] = []
    for m in sorted(rows, key=lambda m: (-m.credibility_score, -m.published_at.timestamp())):
        nt = _nt(m.title)
        if nt not in seen:
            seen.add(nt)
            unique.append(m)
        if len(unique) >= limit:
            break

    # Re-sort by recency for display
    unique.sort(key=lambda m: m.published_at, reverse=True)
    return unique
