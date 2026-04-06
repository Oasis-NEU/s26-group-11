import threading
from datetime import datetime, timezone

from flask import Blueprint, jsonify, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.db.models import Thread, Comment, ThreadVote, CommentVote
from app.extensions import db

discuss_bp = Blueprint("discuss", __name__)


# ── Helpers ──────────────────────────────────────────────────────────────────

def _iso(dt) -> str | None:
    """Return an ISO-8601 string with explicit UTC 'Z' suffix so browsers parse it correctly."""
    if dt is None:
        return None
    s = dt.isoformat()
    # Append 'Z' only when no timezone offset is present (naive datetimes from DB)
    if "+" not in s and s[-1] != "Z":
        s += "Z"
    return s


def _author(user) -> str:
    """Return a safe public display name — never expose email."""
    return user.username or f"user_{user.id}"


def _score_thread_async(thread_id: int, title: str, body: str | None) -> None:
    """Fire-and-forget: score a thread's sentiment in a background thread."""
    app = current_app._get_current_object()

    def _work():
        try:
            from app.services.finbert import score_text
            score = score_text(title, body)
            with app.app_context():
                t = Thread.query.get(thread_id)
                if t:
                    t.sentiment_score = score
                    db.session.commit()
        except Exception as e:
            print(f"[discuss] thread {thread_id} sentiment scoring failed: {e}")

    threading.Thread(target=_work, daemon=True).start()


def _score_comment_async(comment_id: int, body: str) -> None:
    """Fire-and-forget: score a comment's sentiment in a background thread."""
    app = current_app._get_current_object()

    def _work():
        try:
            from app.services.finbert import score_text
            score = score_text(body)
            with app.app_context():
                c = Comment.query.get(comment_id)
                if c:
                    c.sentiment_score = score
                    db.session.commit()
        except Exception as e:
            print(f"[discuss] comment {comment_id} sentiment scoring failed: {e}")

    threading.Thread(target=_work, daemon=True).start()


def _thread_dict(t: Thread, include_comments: bool = False, current_uid: int | None = None) -> dict:
    user_vote = 0
    if current_uid is not None:
        vote = ThreadVote.query.filter_by(thread_id=t.id, user_id=current_uid).first()
        user_vote = vote.value if vote else 0

    d = {
        "id":              t.id,
        "title":           t.title,
        "body":            t.body,
        "ticker":          t.ticker,
        "score":           t.upvotes,
        "user_vote":       user_vote,
        "author":          _author(t.user),
        "username":        t.user.username,
        "avatar_url":      t.user.avatar_url,
        "user_id":         t.user_id,
        "comment_count":   t.comments.count(),
        "sentiment_score": t.sentiment_score,
        "created_at":      _iso(t.created_at),
        "edited_at":       _iso(t.edited_at),
    }
    if include_comments:
        d["comments"] = [_comment_dict(c, current_uid=current_uid) for c in
                         t.comments.order_by(Comment.created_at.asc()).all()]
    return d


def _comment_dict(c: Comment, current_uid: int | None = None) -> dict:
    user_vote = 0
    if current_uid is not None:
        vote = CommentVote.query.filter_by(comment_id=c.id, user_id=current_uid).first()
        user_vote = vote.value if vote else 0

    return {
        "id":              c.id,
        "thread_id":       c.thread_id,
        "body":            c.body,
        "score":           c.upvotes,
        "user_vote":       user_vote,
        "author":          _author(c.user),
        "username":        c.user.username,
        "avatar_url":      c.user.avatar_url,
        "user_id":         c.user_id,
        "sentiment_score": c.sentiment_score,
        "created_at":      _iso(c.created_at),
    }


# ── Threads ───────────────────────────────────────────────────────────────────

@discuss_bp.route("/threads", methods=["GET"])
@jwt_required(optional=True)
def list_threads():
    uid    = int(get_jwt_identity()) if get_jwt_identity() else None
    ticker = (request.args.get("ticker") or "").strip().upper() or None
    sort   = request.args.get("sort", "new")          # new | top
    limit  = request.args.get("limit", 20, type=int)
    offset = request.args.get("offset", 0, type=int)
    search = (request.args.get("q") or "").strip()

    q = Thread.query
    if ticker:
        q = q.filter(Thread.ticker == ticker)
    if search:
        q = q.filter(Thread.title.ilike(f"%{search}%"))

    q = q.order_by(Thread.upvotes.desc() if sort == "top"
                   else Thread.created_at.desc())

    threads = q.offset(offset).limit(limit).all()
    return jsonify([_thread_dict(t, current_uid=uid) for t in threads])


@discuss_bp.route("/threads", methods=["POST"])
@jwt_required()
def create_thread():
    data   = request.get_json() or {}
    title  = (data.get("title")  or "").strip()
    body   = (data.get("body")   or "").strip() or None
    ticker = (data.get("ticker") or "").strip().upper() or None

    if not title:
        return jsonify({"error": "Title is required"}), 400
    if len(title) > 300:
        return jsonify({"error": "Title too long (max 300 chars)"}), 400
    if body and len(body) > 10_000:
        return jsonify({"error": "Body too long (max 10 000 chars)"}), 400

    thread = Thread(user_id=int(get_jwt_identity()),
                    title=title, body=body, ticker=ticker)
    db.session.add(thread)
    db.session.commit()

    # Score sentiment in background thread
    _score_thread_async(thread.id, thread.title, thread.body)

    return jsonify(_thread_dict(thread, current_uid=int(get_jwt_identity()))), 201


@discuss_bp.route("/threads/<int:tid>", methods=["GET"])
@jwt_required(optional=True)
def get_thread(tid: int):
    uid = int(get_jwt_identity()) if get_jwt_identity() else None
    t   = db.get_or_404(Thread, tid)
    return jsonify(_thread_dict(t, include_comments=True, current_uid=uid))


@discuss_bp.route("/threads/<int:tid>", methods=["PUT"])
@jwt_required()
def edit_thread(tid: int):
    uid = int(get_jwt_identity())
    t   = db.get_or_404(Thread, tid)

    if t.user_id != uid:
        return jsonify({"error": "Not authorised"}), 403

    # Enforce 10-minute edit window
    created = t.created_at
    if created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    elapsed = (datetime.now(timezone.utc) - created).total_seconds()
    if elapsed > 600:
        return jsonify({"error": "Edit window has closed (10 minutes)"}), 403

    data  = request.get_json() or {}
    title = (data.get("title") or "").strip()
    body  = (data.get("body")  or "").strip() or None

    if not title:
        return jsonify({"error": "Title is required"}), 400
    if len(title) > 300:
        return jsonify({"error": "Title too long (max 300 chars)"}), 400
    if body and len(body) > 10_000:
        return jsonify({"error": "Body too long (max 10 000 chars)"}), 400

    t.title     = title
    t.body      = body
    t.edited_at = datetime.now(timezone.utc)
    db.session.commit()
    return jsonify(_thread_dict(t, current_uid=uid))


@discuss_bp.route("/threads/<int:tid>", methods=["DELETE"])
@jwt_required()
def delete_thread(tid: int):
    t = db.get_or_404(Thread, tid)
    if t.user_id != int(get_jwt_identity()):
        return jsonify({"error": "Not authorised"}), 403
    db.session.delete(t)
    db.session.commit()
    return jsonify({"ok": True})


@discuss_bp.route("/threads/<int:tid>/vote", methods=["POST"])
@jwt_required()
def vote_thread(tid: int):
    direction = (request.get_json() or {}).get("direction", "up")
    value     = 1 if direction == "up" else -1
    uid       = int(get_jwt_identity())
    t         = db.get_or_404(Thread, tid)

    existing = ThreadVote.query.filter_by(thread_id=tid, user_id=uid).first()
    if existing is None:
        db.session.add(ThreadVote(thread_id=tid, user_id=uid, value=value))
        t.upvotes += value
        user_vote = value
    elif existing.value == value:          # same direction → retract
        t.upvotes -= existing.value
        db.session.delete(existing)
        user_vote = 0
    else:                                  # opposite direction → switch
        t.upvotes += value * 2
        existing.value = value
        user_vote = value

    db.session.commit()
    return jsonify({"score": t.upvotes, "user_vote": user_vote})


# ── Comments ─────────────────────────────────────────────────────────────────

@discuss_bp.route("/threads/<int:tid>/comments", methods=["POST"])
@jwt_required()
def add_comment(tid: int):
    db.get_or_404(Thread, tid)            # 404 if thread doesn't exist
    data = request.get_json() or {}
    body = (data.get("body") or "").strip()

    if not body:
        return jsonify({"error": "Comment cannot be empty"}), 400
    if len(body) > 5000:
        return jsonify({"error": "Comment too long"}), 400

    c = Comment(thread_id=tid, user_id=int(get_jwt_identity()), body=body)
    db.session.add(c)
    db.session.commit()

    _score_comment_async(c.id, c.body)

    return jsonify(_comment_dict(c, current_uid=int(get_jwt_identity()))), 201


@discuss_bp.route("/comments/<int:cid>", methods=["DELETE"])
@jwt_required()
def delete_comment(cid: int):
    c = db.get_or_404(Comment, cid)
    if c.user_id != int(get_jwt_identity()):
        return jsonify({"error": "Not authorised"}), 403
    db.session.delete(c)
    db.session.commit()
    return jsonify({"ok": True})


@discuss_bp.route("/comments/<int:cid>/vote", methods=["POST"])
@jwt_required()
def vote_comment(cid: int):
    direction = (request.get_json() or {}).get("direction", "up")
    value     = 1 if direction == "up" else -1
    uid       = int(get_jwt_identity())
    c         = db.get_or_404(Comment, cid)

    existing = CommentVote.query.filter_by(comment_id=cid, user_id=uid).first()
    if existing is None:
        db.session.add(CommentVote(comment_id=cid, user_id=uid, value=value))
        c.upvotes += value
        user_vote = value
    elif existing.value == value:
        c.upvotes -= existing.value
        db.session.delete(existing)
        user_vote = 0
    else:
        c.upvotes += value * 2
        existing.value = value
        user_vote = value

    db.session.commit()
    return jsonify({"score": c.upvotes, "user_vote": user_vote})


# ── Community Sentiment ────────────────────────────────────────────────────────

@discuss_bp.route("/sentiment")
def community_sentiment():
    """
    GET /api/discuss/sentiment?ticker=AAPL
    Returns aggregated community sentiment for a ticker.
    """
    ticker = request.args.get("ticker", "").upper()
    if not ticker:
        return jsonify({"error": "ticker required"}), 400

    threads = Thread.query.filter(
        Thread.ticker == ticker,
        Thread.sentiment_score.isnot(None),
    ).all()

    comments = (
        Comment.query
        .join(Thread, Comment.thread_id == Thread.id)
        .filter(
            Thread.ticker == ticker,
            Comment.sentiment_score.isnot(None),
        )
        .all()
    )

    thread_scores  = [t.sentiment_score for t in threads]
    comment_scores = [c.sentiment_score for c in comments]
    all_scores     = thread_scores + comment_scores

    def _avg(lst):
        return round(sum(lst) / len(lst), 4) if lst else None

    return jsonify({
        "ticker":              ticker,
        "community_sentiment": _avg(all_scores),
        "thread_sentiment":    _avg(thread_scores),
        "comment_sentiment":   _avg(comment_scores),
        "thread_count":        len(threads),
        "comment_count":       len(comments),
    })
