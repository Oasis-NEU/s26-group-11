from flask import Blueprint, jsonify

from flask_jwt_extended import jwt_required, get_jwt_identity

from app.db.models import User, Thread, WatchlistList, WatchlistListItem, Follow
from app.extensions import db

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
        "id":           user.id,
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


@users_bp.route("/<int:uid>/follow", methods=["POST"])
@jwt_required()
def follow_user(uid: int):
    me = int(get_jwt_identity())
    if me == uid:
        return jsonify({"error": "Cannot follow yourself"}), 400
    if not User.query.get(uid):
        return jsonify({"error": "User not found"}), 404
    existing = Follow.query.filter_by(follower_id=me, following_id=uid).first()
    if existing:
        return jsonify({"following": True})
    db.session.add(Follow(follower_id=me, following_id=uid))
    db.session.commit()
    return jsonify({"following": True})


@users_bp.route("/<int:uid>/follow", methods=["DELETE"])
@jwt_required()
def unfollow_user(uid: int):
    me = int(get_jwt_identity())
    existing = Follow.query.filter_by(follower_id=me, following_id=uid).first()
    if existing:
        db.session.delete(existing)
        db.session.commit()
    return jsonify({"following": False})


@users_bp.route("/<int:uid>/followers", methods=["GET"])
def get_followers(uid: int):
    follows = Follow.query.filter_by(following_id=uid).all()
    follower_ids = [f.follower_id for f in follows]
    users = User.query.filter(User.id.in_(follower_ids)).all() if follower_ids else []
    return jsonify([{"id": u.id, "username": u.username} for u in users])


@users_bp.route("/<int:uid>/following", methods=["GET"])
def get_following(uid: int):
    follows = Follow.query.filter_by(follower_id=uid).all()
    following_ids = [f.following_id for f in follows]
    users = User.query.filter(User.id.in_(following_ids)).all() if following_ids else []
    return jsonify([{"id": u.id, "username": u.username} for u in users])


@users_bp.route("/<int:uid>/follow/status", methods=["GET"])
@jwt_required(optional=True)
def follow_status(uid: int):
    me_str = get_jwt_identity()
    if not me_str:
        return jsonify({"following": False})
    me = int(me_str)
    existing = Follow.query.filter_by(follower_id=me, following_id=uid).first()
    return jsonify({"following": bool(existing)})
