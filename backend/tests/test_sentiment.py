"""
Tests for app/services/sentiment.py

Covers:
- label()           : maps a float score to a human-readable tier
- weighted_aggregate(): credibility + recency-decay weighted mean
"""

import math
from datetime import datetime, timedelta, timezone

import pytest

from app.services.sentiment import label, weighted_aggregate


# ── label() ──────────────────────────────────────────────────────────────────

class TestLabel:
    def test_strongly_positive(self):
        assert label(0.35) == "strongly positive"
        assert label(0.80) == "strongly positive"

    def test_positive(self):
        assert label(0.05) == "positive"
        assert label(0.20) == "positive"

    def test_neutral(self):
        assert label(0.0)   == "neutral"
        assert label(0.04)  == "neutral"
        assert label(-0.04) == "neutral"

    def test_negative(self):
        assert label(-0.05) == "negative"
        assert label(-0.20) == "negative"

    def test_strongly_negative(self):
        assert label(-0.35) == "strongly negative"
        assert label(-0.90) == "strongly negative"


# ── weighted_aggregate() ─────────────────────────────────────────────────────

def _now():
    return datetime.now(timezone.utc)


class TestWeightedAggregate:
    def test_empty_list_returns_none_score(self):
        result = weighted_aggregate([])
        assert result["score"] is None
        assert result["count"] == 0

    def test_single_item(self):
        items = [(0.5, 100, _now())]
        result = weighted_aggregate(items)
        assert result["score"] == pytest.approx(0.5, abs=0.01)
        assert result["count"] == 1

    def test_skips_none_scores(self):
        items = [
            (None, 80, _now()),
            (0.4,  80, _now()),
        ]
        result = weighted_aggregate(items)
        assert result["score"] == pytest.approx(0.4, abs=0.01)
        assert result["count"] == 1

    def test_high_credibility_dominates(self):
        """A Bloomberg article (cred=100) from 1h ago should outweigh
        a low-cred source (cred=20) with a very different score."""
        now = _now()
        items = [
            (0.8,  100, now - timedelta(hours=1)),   # Bloomberg-tier, recent
            (-0.5,  20, now - timedelta(hours=2)),   # Low-cred noise
        ]
        result = weighted_aggregate(items)
        # Result should be clearly positive, pulled toward 0.8
        assert result["score"] > 0.5

    def test_recency_decay(self):
        """A score from 48h ago should have much less weight than one from 1h ago."""
        now = _now()
        items = [
            (0.8, 80, now - timedelta(hours=1)),    # recent, positive
            (-0.8, 80, now - timedelta(hours=48)),  # old, negative — should matter less
        ]
        result = weighted_aggregate(items)
        # Net should be positive because the recent article dominates
        assert result["score"] > 0.0

    def test_equal_weight_averages(self):
        """Two identical-weight items should average their scores."""
        now = _now()
        items = [
            (0.6, 80, now),
            (0.2, 80, now),
        ]
        result = weighted_aggregate(items)
        assert result["score"] == pytest.approx(0.4, abs=0.05)
        assert result["count"] == 2

    def test_all_none_scores(self):
        items = [(None, 80, _now()), (None, 60, _now())]
        result = weighted_aggregate(items)
        assert result["score"] is None
        assert result["count"] == 0
