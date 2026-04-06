from flask import Blueprint, jsonify

from app.db.models import User, Thread, WatchlistList, WatchlistListItem

users_bp = Blueprint("users", __name__)


def _iso(dt) -> str | None:
    """ISO-8601 with explicit UTC 'Z' so JavaScript parses it as UTC, not local time."""
    if dt is None:
        return None
    s = dt.isoformat()
    if "+" not in s and not s.endswith("Z"):
        s += "Z"
    return s


def _display_name(user: User) -> str | None:
    if user.first_name and user.last_name:
        return f"{user.first_name} {user.last_name}"
    if user.first_name:
        return user.first_name
    return None


def _thread_mini(t: Thread) -> dict:
    return {
        "id":            t.id,
        "title":         t.title,
        "ticker":        t.ticker,
        "upvotes":       t.upvotes,
        "comment_count": t.comments.count(),
        "created_at":    _iso(t.created_at),
    }


@users_bp.route("/<username>", methods=["GET"])
def get_public_profile(username: str):
    user = User.query.filter_by(username=username).first_or_404()

    threads = (
        Thread.query
        .filter_by(user_id=user.id)
        .order_by(Thread.created_at.desc())
        .limit(20)
        .all()
    )

    public_lists = (
        WatchlistList.query
        .filter_by(user_id=user.id, is_public=True)
        .order_by(WatchlistList.created_at.asc())
        .all()
    )

    return jsonify({
        "username":     user.username,
        "display_name": _display_name(user),
        "first_name":   user.first_name,
        "last_name":    user.last_name,
        "bio":          user.bio,
        "avatar_url":   user.avatar_url,
        "member_since": _iso(user.created_at),
        "thread_count": Thread.query.filter_by(user_id=user.id).count(),
        "threads":      [_thread_mini(t) for t in threads],
        "public_watchlists": [
            {
                "id":    wl.id,
                "name":  wl.name,
                "items": [item.ticker for item in
                          wl.list_items.order_by(WatchlistListItem.added_at.asc()).all()],
            }
            for wl in public_lists
        ],
    })
