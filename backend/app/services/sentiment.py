"""
Sentiment scoring using VADER (Valence Aware Dictionary and sEntiment Reasoner).

VADER is purpose-built for short social/financial text. It runs locally in
~1ms per headline with no API calls or rate limits.

Score range: -1.0 (strongly bearish) → 0.0 (neutral) → +1.0 (strongly bullish)
We use the 'compound' score, which is the most useful single metric.

Financial booster words are added to VADER's lexicon to improve accuracy on
financial headlines (e.g. "beat earnings" should score more positive than
the base lexicon gives it).

weighted_aggregate() improves over a naive mean by:
  1. Credibility weighting — Bloomberg (100) outweighs PR Newswire (60)
  2. Recency decay — exponential decay with 24h half-life so fresh news
     dominates over stale headlines from 5 days ago
"""
from __future__ import annotations

import math
from datetime import datetime, timezone

from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

# ── VADER instance (singleton — loading the lexicon is the slow part) ─────────
_analyzer: SentimentIntensityAnalyzer | None = None


def _get_analyzer() -> SentimentIntensityAnalyzer:
    global _analyzer
    if _analyzer is None:
        _analyzer = SentimentIntensityAnalyzer()
        # Boost financial-specific terms that VADER underweights
        _analyzer.lexicon.update({
            # Bullish signals
            "beat":          2.5,
            "beats":         2.5,
            "surpassed":     2.5,
            "outperformed":  2.5,
            "upgrade":       2.0,
            "upgraded":      2.0,
            "outperform":    2.0,
            "buy":           1.5,
            "overweight":    1.5,
            "bullish":       3.0,
            "rally":         2.0,
            "rallied":       2.0,
            "soared":        2.5,
            "surged":        2.5,
            "record":        1.5,
            "profit":        1.5,
            "growth":        1.5,
            "dividend":      1.0,
            "breakout":      2.0,
            # Bearish signals
            "miss":         -2.5,
            "missed":       -2.5,
            "downgrade":    -2.0,
            "downgraded":   -2.0,
            "underperform": -2.0,
            "sell":         -1.5,
            "underweight":  -1.5,
            "bearish":      -3.0,
            "plunged":      -2.5,
            "crashed":      -3.0,
            "slumped":      -2.0,
            "tumbled":      -2.5,
            "layoffs":      -2.0,
            "layoff":       -2.0,
            "recall":       -1.5,
            "lawsuit":      -1.5,
            "investigation": -1.5,
            "fraud":        -3.0,
            "bankruptcy":   -3.5,
            "defaulted":    -3.0,
        })
    return _analyzer


def score_text(title: str, summary: str | None = None) -> float:
    """
    Score a news article headline (+ optional summary) and return the
    compound VADER score in [-1.0, +1.0].

    We weight the title 2× vs summary because headlines are more signal-dense.
    """
    analyzer = _get_analyzer()

    title_score   = analyzer.polarity_scores(title)["compound"]
    if summary:
        summary_score = analyzer.polarity_scores(summary)["compound"]
        return round((title_score * 2 + summary_score) / 3, 4)
    return round(title_score, 4)


# ── 5-level label thresholds ──────────────────────────────────────────────────
#   ≥ +0.35  →  Strongly Bullish   (clear positive signal, multiple strong keywords)
#   ≥ +0.05  →  Bullish            (mild positive lean)
#   > −0.05  →  Neutral            (near-zero, no clear direction)
#   > −0.35  →  Bearish            (mild negative lean)
#   ≤ −0.35  →  Strongly Bearish   (clear negative signal)

def label(score: float) -> str:
    """5-level human-readable sentiment label from a compound VADER score."""
    if score >= 0.35:  return "Strongly Bullish"
    if score >= 0.05:  return "Bullish"
    if score <= -0.35: return "Strongly Bearish"
    if score <= -0.05: return "Bearish"
    return "Neutral"


def aggregate(scores: list[float]) -> float | None:
    """Simple mean of a list of scores. Returns None if the list is empty.
    Kept for backfill and one-off use; prefer weighted_aggregate() for UI display."""
    if not scores:
        return None
    return round(sum(scores) / len(scores), 4)


def weighted_aggregate(
    items: list[tuple[float | None, float | None, "datetime | None"]],
    *,
    half_life_hours: float = 24.0,
) -> dict:
    """
    Credibility + recency weighted mean.

    Args:
        items: list of (sentiment_score, credibility_score, published_at)
               credibility_score is on the 0–100 scale used by whitelist.py.
               published_at should be timezone-aware; naive datetimes are
               treated as UTC.
        half_life_hours: recency decay half-life (default 24h).
                         An article published 24h ago counts 50% as much,
                         48h ago → 25%, 72h ago → ~12%, etc.

    Returns:
        {"score": float | None, "count": int}
        score is None when no scored items are present.
        count is the number of articles that had a non-None sentiment_score.
    """
    if not items:
        return {"score": None, "count": 0}

    now = datetime.now(timezone.utc)
    decay_k = math.log(2) / half_life_hours   # ≈ 0.0289 for 24h

    total_weight = 0.0
    weighted_sum = 0.0
    valid_count  = 0

    for score, cred, pub in items:
        if score is None:
            continue
        valid_count += 1

        # Ensure timezone-aware
        if pub is not None:
            if pub.tzinfo is None:
                pub = pub.replace(tzinfo=timezone.utc)
            age_hours = (now - pub).total_seconds() / 3600.0
        else:
            age_hours = 168.0   # treat missing timestamps as 1-week-old

        recency_w  = math.exp(-decay_k * max(age_hours, 0.0))
        cred_w     = (cred or 50) / 100.0          # default mid-tier if missing
        w          = cred_w * recency_w

        weighted_sum  += score * w
        total_weight  += w

    if total_weight == 0.0 or valid_count == 0:
        return {"score": None, "count": 0}

    return {
        "score": round(weighted_sum / total_weight, 4),
        "count": valid_count,
    }


def snapshot_ticker(ticker: str, target_date=None) -> None:
    """
    Compute and upsert a SentimentSnapshot for `ticker` on `target_date` (default today).
    Called by the scheduler after each ingest cycle.
    """
    from sqlalchemy.dialects.postgresql import insert as pg_insert
    from app.db.models import Mention, SentimentSnapshot
    from app.extensions import db
    import datetime as _dt

    if target_date is None:
        target_date = datetime.now(timezone.utc).date()

    # Gather all mentions for this ticker published on target_date
    day_start = datetime(target_date.year, target_date.month, target_date.day,
                         tzinfo=timezone.utc)
    day_end   = day_start + _dt.timedelta(days=1)

    mentions = (
        Mention.query
        .filter(
            Mention.ticker == ticker.upper(),
            Mention.published_at >= day_start,
            Mention.published_at <  day_end,
        )
        .all()
    )

    if not mentions:
        return

    items = [(m.sentiment_score, float(m.credibility_score), m.published_at)
             for m in mentions]
    result = weighted_aggregate(items)

    avg_cred = (
        sum(m.credibility_score for m in mentions) / len(mentions)
        if mentions else None
    )

    stmt = pg_insert(SentimentSnapshot).values(
        ticker=ticker.upper(),
        date=target_date,
        score=result["score"],
        mention_count=result["count"],
        avg_credibility=avg_cred,
        source_type="news",
    ).on_conflict_do_update(
        constraint="uq_snapshot_ticker_date",
        set_=dict(
            score=result["score"],
            mention_count=result["count"],
            avg_credibility=avg_cred,
        ),
    )
    db.session.execute(stmt)
    db.session.commit()
