"""
FinBERT sentiment scoring — replaces VADER for financial text.

ProsusAI/finbert is a BERT model fine-tuned on financial news.
It returns three classes: positive, neutral, negative.
Score = positive_prob - negative_prob, mapped to [-1.0, +1.0].

Set FINBERT_DISABLED=1 to fall back to VADER (for CI / testing).
"""
from __future__ import annotations

import logging
import os

log = logging.getLogger(__name__)

_pipeline = None

FINBERT_DISABLED = os.getenv("FINBERT_DISABLED", "").lower() in ("1", "true", "yes")

# Financial lexicon post-processing boosts (scaled down from VADER's ±4 range to ±0.08)
_LEXICON: dict[str, float] = {
    "beat": 0.06, "beats": 0.06, "surpassed": 0.06, "outperformed": 0.06,
    "upgrade": 0.05, "upgraded": 0.05, "outperform": 0.05,
    "buy": 0.04, "overweight": 0.04, "bullish": 0.07, "rally": 0.05,
    "rallied": 0.05, "soared": 0.06, "surged": 0.06, "record": 0.04,
    "profit": 0.04, "growth": 0.04, "breakout": 0.05, "dividend": 0.03,
    "miss": -0.06, "missed": -0.06, "downgrade": -0.05, "downgraded": -0.05,
    "underperform": -0.05, "sell": -0.04, "underweight": -0.04,
    "bearish": -0.07, "plunged": -0.06, "crashed": -0.07,
    "slumped": -0.05, "tumbled": -0.06, "layoffs": -0.05, "layoff": -0.05,
    "recall": -0.04, "lawsuit": -0.04, "investigation": -0.04,
    "fraud": -0.07, "bankruptcy": -0.08, "defaulted": -0.07,
}


def _get_pipeline():
    global _pipeline
    if _pipeline is None:
        log.info("[finbert] loading ProsusAI/finbert (first run downloads ~440 MB)...")
        print("[finbert] loading ProsusAI/finbert — this may take a moment on first run...")
        from transformers import pipeline as hf_pipeline
        _pipeline = hf_pipeline(
            "text-classification",
            model="ProsusAI/finbert",
            top_k=None,        # return all 3 label probabilities
            truncation=True,
            max_length=512,
        )
        log.info("[finbert] model loaded successfully")
        print("[finbert] model loaded")
    return _pipeline


def _lexicon_boost(text: str) -> float:
    lowered = text.lower()
    boost = sum(delta for term, delta in _LEXICON.items() if term in lowered)
    return max(-0.20, min(0.20, boost))


def score_batch(texts: list[str]) -> list[float]:
    """
    Score a list of text strings in one forward pass.
    Returns floats in [-1.0, +1.0].
    Falls back to VADER if FINBERT_DISABLED or on error.
    """
    if not texts:
        return []

    if FINBERT_DISABLED:
        from app.services.sentiment import score_text as vader_score
        return [vader_score(t) for t in texts]

    try:
        pipe = _get_pipeline()
        results = pipe(texts, batch_size=16)
        scores = []
        for item_results in results:
            label_map = {r["label"].lower(): r["score"] for r in item_results}
            pos = label_map.get("positive", 0.0)
            neg = label_map.get("negative", 0.0)
            scores.append(round(pos - neg, 4))
        return scores
    except Exception as e:
        log.warning(f"[finbert] batch scoring failed, falling back to VADER: {e}")
        from app.services.sentiment import score_text as vader_score
        return [vader_score(t) for t in texts]


def score_text(title: str, summary: str | None = None) -> float:
    """
    Score a single article headline + optional summary.
    Title is weighted 2x. Applies lexicon boost on top of FinBERT score.
    Interface-compatible with sentiment.score_text().
    """
    text = f"{title}. {title}. {summary}" if summary else f"{title}. {title}"
    base = score_batch([text])[0]
    boost = _lexicon_boost(f"{title} {summary or ''}")
    return round(max(-1.0, min(1.0, base + boost)), 4)
