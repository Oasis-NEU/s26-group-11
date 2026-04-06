"""
/api/user/preferences  — GET / PUT user preferences
/api/user/track        — POST  click event (personalized feed)
/api/user/personalized — GET   personalized mention feed
/api/feedback          — POST  submit feedback
"""

import json
from datetime import datetime, timedelta, timezone

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required, verify_jwt_in_request

from app.db.models import ClickEvent, Feedback, Mention, UserPreference, WatchlistItem
from app.extensions import db
from app.services.sentiment import label as sentiment_label

prefs_bp = Blueprint("preferences", __name__)

_DEFAULTS = {
    "accent_color":      "#22c55e",
    "default_timeframe": "1M",
    "density":           "comfortable",
    "hidden_sections":   [],
    "min_credibility":   0,
}


def _get_or_create_prefs(user_id: int) -> UserPreference:
    pref = UserPreference.query.filter_by(user_id=user_id).first()
    if not pref:
        pref = UserPreference(user_id=user_id)
        db.session.add(pref)
        db.session.commit()
    return pref


# ─── GET /api/user/preferences ───────────────────────────────────────────────

@prefs_bp.route("/preferences", methods=["GET"])
def get_preferences():
    """Returns preferences for logged-in user, or defaults for guest."""
    try:
        verify_jwt_in_request(optional=True)
        uid = get_jwt_identity()
    except Exception:
        uid = None

    if not uid:
        return jsonify(_DEFAULTS)

    pref = _get_or_create_prefs(int(uid))
    return jsonify(pref.to_dict())


# ─── PUT /api/user/preferences ───────────────────────────────────────────────

@prefs_bp.route("/preferences", methods=["PUT"])
@jwt_required()
def update_preferences():
    uid  = int(get_jwt_identity())
    data = request.get_json() or {}
    pref = _get_or_create_prefs(uid)

    ALLOWED_TIMEFRAMES = {"1D", "1W", "1M", "3M", "1Y"}
    ALLOWED_DENSITIES  = {"compact", "comfortable"}

    if "accent_color" in data:
        color = str(data["accent_color"]).strip()
        if color.startswith("#") and len(color) in (4, 7):
            pref.accent_color = color

    if "default_timeframe" in data:
        tf = str(data["default_timeframe"]).upper()
        if tf in ALLOWED_TIMEFRAMES:
            pref.default_timeframe = tf

    if "density" in data:
        d = str(data["density"]).lower()
        if d in ALLOWED_DENSITIES:
            pref.density = d

    if "hidden_sections" in data:
        sections = data["hidden_sections"]
        if isinstance(sections, list):
            pref.hidden_sections = json.dumps([str(s) for s in sections])

    if "min_credibility" in data:
        try:
            mc = int(data["min_credibility"])
            pref.min_credibility = max(0, min(100, mc))
        except (TypeError, ValueError):
            pass

    pref.updated_at = datetime.now(timezone.utc)
    db.session.commit()
    return jsonify(pref.to_dict())


# ─── POST /api/user/track ────────────────────────────────────────────────────

@prefs_bp.route("/track", methods=["POST"])
@jwt_required()
def track_click():
    """Log a stock-page view for personalization scoring."""
    uid    = int(get_jwt_identity())
    data   = request.get_json() or {}
    ticker = str(data.get("ticker", "")).upper().strip()
    if not ticker:
        return jsonify({"error": "ticker required"}), 400

    event = ClickEvent(user_id=uid, ticker=ticker)
    db.session.add(event)
    db.session.commit()
    return jsonify({"ok": True})


# ─── GET /api/user/personalized ──────────────────────────────────────────────

@prefs_bp.route("/personalized", methods=["GET"])
def personalized_feed():
    """
    Returns up to 60 mentions scored by:
      - watchlist affinity  (3× boost)
      - recent click history (up to 2× boost)
      - sentiment strength  (1× boost for strong signal)
    Falls back to recency-sorted feed for guests.
    """
    try:
        verify_jwt_in_request(optional=True)
        uid = get_jwt_identity()
    except Exception:
        uid = None

    # Optional credibility floor from query param
    min_cred = request.args.get("min_credibility", 0, type=int)

    cutoff = datetime.utcnow() - timedelta(days=7)
    q = Mention.query.filter(Mention.published_at >= cutoff)
    if min_cred > 0:
        q = q.filter(Mention.credibility_score >= min_cred)

    mentions = q.order_by(Mention.published_at.desc()).limit(200).all()

    if not uid:
        # Guest: just return recent feed filtered by credibility
        data = [_m_dict(m) for m in mentions[:60]]
        return jsonify(data)

    uid = int(uid)

    # Build watchlist set
    watchlist_rows = WatchlistItem.query.filter_by(user_id=uid).all()
    watchlist = {w.ticker.upper() for w in watchlist_rows}

    # Build click counts (last 14 days)
    click_cutoff = datetime.utcnow() - timedelta(days=14)
    click_rows = ClickEvent.query.filter(
        ClickEvent.user_id == uid,
        ClickEvent.clicked_at >= click_cutoff,
    ).all()
    click_counts: dict[str, int] = {}
    for c in click_rows:
        click_counts[c.ticker] = click_counts.get(c.ticker, 0) + 1

    # Score each mention
    scored = []
    for m in mentions:
        ticker = m.ticker.upper()
        score  = 1.0                                              # base

        if ticker in watchlist:
            score *= 3.0                                          # watchlist 3×

        if ticker in click_counts:
            clicks = min(click_counts[ticker], 10)
            score *= 1.0 + (clicks / 10.0)                       # up to 2×

        if m.sentiment_score is not None:
            score *= 1.0 + abs(m.sentiment_score)                 # strong sentiment boost

        scored.append((score, m))

    scored.sort(key=lambda x: x[0], reverse=True)
    data = [_m_dict(m) for _, m in scored[:60]]
    return jsonify(data)


def _m_dict(m: Mention) -> dict:
    score = m.sentiment_score
    return {
        "id":               m.id,
        "ticker":           m.ticker,
        "source":           m.source_type,
        "text":             m.title,
        "url":              m.url,
        "author":           m.source_domain,
        "author_verified":  False,
        "upvotes":          0,
        "credibility_score":m.credibility_score,
        "sentiment_score":  score,
        "sentiment_label":  sentiment_label(score) if score is not None else None,
        "news_source":      m.source_domain if m.source_type == "news" else None,
        "subreddit":        None,
        "published_at":     m.published_at.isoformat(),
    }


# ─── POST /api/feedback ──────────────────────────────────────────────────────

@prefs_bp.route("/feedback", methods=["POST"])
def submit_feedback():
    try:
        verify_jwt_in_request(optional=True)
        uid = get_jwt_identity()
    except Exception:
        uid = None

    data     = request.get_json() or {}
    message  = str(data.get("message", "")).strip()
    category = str(data.get("category", "general")).lower()
    email    = str(data.get("email", "")).strip() or None
    rating   = data.get("rating")

    if not message:
        return jsonify({"error": "message required"}), 400

    ALLOWED_CATEGORIES = {"bug", "feature", "general"}
    if category not in ALLOWED_CATEGORIES:
        category = "general"

    try:
        rating = int(rating)
        rating = max(1, min(5, rating))
    except (TypeError, ValueError):
        rating = None

    fb = Feedback(
        user_id  = int(uid) if uid else None,
        email    = email,
        category = category,
        message  = message,
        rating   = rating,
    )
    db.session.add(fb)
    db.session.commit()
    return jsonify({"ok": True, "id": fb.id}), 201
