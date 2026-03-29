"""
Two-tier sentiment analysis:
  - VADER: fast, used for all stocks
  - FinBERT: higher accuracy, used for top-100 stocks via HuggingFace Inference API
"""

import re
import os
import requests
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

_vader = SentimentIntensityAnalyzer()

FINBERT_API_URL = (
    "https://api-inference.huggingface.co/models/ProsusAI/finbert"
)

# Map emojis commonly used in financial contexts to words
_EMOJI_MAP = {
    "🚀": "rocket bullish",
    "📈": "rising bullish",
    "📉": "falling bearish",
    "💎": "diamond hold",
    "🐻": "bear bearish",
    "🐂": "bull bullish",
    "🔥": "fire hot",
    "💰": "money profit",
    "🤑": "money profit",
    "❌": "bad loss",
    "⚠️": "warning risk",
}


def _clean_text(text: str) -> str:
    """Normalize text for sentiment analysis."""
    # Replace known emojis
    for emoji, replacement in _EMOJI_MAP.items():
        text = text.replace(emoji, f" {replacement} ")
    # Remove URLs
    text = re.sub(r"https?://\S+", "", text)
    # Collapse whitespace
    text = re.sub(r"\s+", " ", text).strip()
    return text


def analyze_vader(text: str) -> dict:
    """
    Returns:
        {
            "score": float,   # compound score: -1.0 → 1.0
            "label": str,     # "positive" | "neutral" | "negative"
            "model": "vader"
        }
    """
    cleaned = _clean_text(text)
    scores = _vader.polarity_scores(cleaned)
    compound = scores["compound"]

    if compound >= 0.05:
        label = "positive"
    elif compound <= -0.05:
        label = "negative"
    else:
        label = "neutral"

    return {"score": round(compound, 4), "label": label, "model": "vader"}


def analyze_finbert(text: str) -> dict:
    """
    Calls HuggingFace Inference API for FinBERT sentiment.
    Falls back to VADER on quota/error.

    Returns same shape as analyze_vader.
    """
    token = os.environ.get("HUGGINGFACE_API_TOKEN", "")
    if not token:
        return analyze_vader(text)

    cleaned = _clean_text(text)[:512]   # FinBERT max input length
    try:
        response = requests.post(
            FINBERT_API_URL,
            headers={"Authorization": f"Bearer {token}"},
            json={"inputs": cleaned},
            timeout=10,
        )
        response.raise_for_status()
        results = response.json()

        # API returns list of lists: [[{label, score}, ...]]
        if isinstance(results, list) and results:
            preds = results[0] if isinstance(results[0], list) else results
            best = max(preds, key=lambda x: x["score"])
            label = best["label"].lower()    # "positive" | "neutral" | "negative"

            # Map to signed score
            if label == "positive":
                score = best["score"]
            elif label == "negative":
                score = -best["score"]
            else:
                score = 0.0

            return {"score": round(score, 4), "label": label, "model": "finbert"}

    except Exception:
        pass

    return analyze_vader(text)


def analyze(text: str, use_finbert: bool = False) -> dict:
    """Entry point. Use FinBERT for top-tier stocks, VADER otherwise."""
    if use_finbert:
        return analyze_finbert(text)
    return analyze_vader(text)
