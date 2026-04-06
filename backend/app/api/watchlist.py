from flask import Blueprint, jsonify, request
from werkzeug.routing import BaseConverter
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.db.models import WatchlistItem, WatchlistList, WatchlistListItem
from app.extensions import db


class TickerConverter(BaseConverter):
    """Only matches stock ticker symbols (1-10 uppercase alphanumeric chars).
    Prevents '/lists', '/legacy', etc. from being captured by the /<ticker> rule."""
    regex = r'[A-Z0-9]{1,10}'


watchlist_bp = Blueprint("watchlist", __name__)
watchlist_bp.record_once(
    lambda state: state.app.url_map.converters.update({'ticker_sym': TickerConverter})
)


def _list_dict(wl: WatchlistList) -> dict:
    return {
        "id":         wl.id,
        "name":       wl.name,
        "is_public":  wl.is_public,
        "created_at": wl.created_at.isoformat(),
        "items":      [{"ticker": i.ticker, "added_at": i.added_at.isoformat()}
                       for i in wl.list_items.order_by(WatchlistListItem.added_at.desc()).all()],
    }


@watchlist_bp.route("", methods=["GET"])
@jwt_required()
def get_watchlist():
    user_id = int(get_jwt_identity())
    items = WatchlistItem.query.filter_by(user_id=user_id).order_by(WatchlistItem.added_at.desc()).all()
    return jsonify([{"ticker": item.ticker, "added_at": item.added_at.isoformat()} for item in items])


@watchlist_bp.route("", methods=["POST"])
@jwt_required()
def add_to_watchlist():
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}
    ticker = (data.get("ticker") or "").strip().upper()
    if not ticker:
        return jsonify(error="ticker is required"), 400

    if WatchlistItem.query.filter_by(user_id=user_id, ticker=ticker).first():
        return jsonify(error="Already in watchlist"), 409

    item = WatchlistItem(user_id=user_id, ticker=ticker)
    db.session.add(item)
    db.session.commit()
    return jsonify(ticker=item.ticker, added_at=item.added_at.isoformat()), 201


@watchlist_bp.route("/<ticker_sym:ticker>", methods=["DELETE"])
@jwt_required()
def remove_from_watchlist(ticker):
    user_id = int(get_jwt_identity())
    item = WatchlistItem.query.filter_by(user_id=user_id, ticker=ticker.upper()).first_or_404()
    db.session.delete(item)
    db.session.commit()
    return "", 204


# ── Named Watchlists ──────────────────────────────────────────────────────────

@watchlist_bp.route("/lists", methods=["GET"])
@jwt_required()
def get_watchlist_lists():
    user_id = int(get_jwt_identity())
    lists = WatchlistList.query.filter_by(user_id=user_id).order_by(WatchlistList.created_at.asc()).all()
    return jsonify([_list_dict(wl) for wl in lists])


@watchlist_bp.route("/lists", methods=["POST"])
@jwt_required()
def create_watchlist_list():
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify(error="Name is required"), 400
    if len(name) > 100:
        return jsonify(error="Name too long (max 100 chars)"), 400

    wl = WatchlistList(user_id=user_id, name=name, is_public=data.get("is_public", False))
    db.session.add(wl)
    db.session.commit()
    return jsonify(_list_dict(wl)), 201


@watchlist_bp.route("/lists/<int:list_id>", methods=["PUT"])
@jwt_required()
def update_watchlist_list(list_id: int):
    user_id = int(get_jwt_identity())
    wl = WatchlistList.query.filter_by(id=list_id, user_id=user_id).first_or_404()
    data = request.get_json() or {}
    if "name" in data:
        name = (data["name"] or "").strip()
        if not name:
            return jsonify(error="Name cannot be empty"), 400
        wl.name = name[:100]
    if "is_public" in data:
        wl.is_public = bool(data["is_public"])
    db.session.commit()
    return jsonify(_list_dict(wl))


@watchlist_bp.route("/lists/<int:list_id>", methods=["DELETE"])
@jwt_required()
def delete_watchlist_list(list_id: int):
    user_id = int(get_jwt_identity())
    wl = WatchlistList.query.filter_by(id=list_id, user_id=user_id).first_or_404()
    db.session.delete(wl)
    db.session.commit()
    return "", 204


@watchlist_bp.route("/lists/<int:list_id>/items", methods=["POST"])
@jwt_required()
def add_to_list(list_id: int):
    user_id = int(get_jwt_identity())
    wl = WatchlistList.query.filter_by(id=list_id, user_id=user_id).first_or_404()
    data = request.get_json() or {}
    ticker = (data.get("ticker") or "").strip().upper()
    if not ticker:
        return jsonify(error="ticker is required"), 400

    if WatchlistListItem.query.filter_by(list_id=wl.id, ticker=ticker).first():
        return jsonify(error="Already in this list"), 409

    item = WatchlistListItem(list_id=wl.id, ticker=ticker)
    db.session.add(item)
    db.session.commit()
    return jsonify(ticker=item.ticker, added_at=item.added_at.isoformat()), 201


@watchlist_bp.route("/lists/<int:list_id>/items/<ticker_sym:ticker>", methods=["DELETE"])
@jwt_required()
def remove_from_list(list_id: int, ticker: str):
    user_id = int(get_jwt_identity())
    wl = WatchlistList.query.filter_by(id=list_id, user_id=user_id).first_or_404()
    item = WatchlistListItem.query.filter_by(list_id=wl.id, ticker=ticker.upper()).first_or_404()
    db.session.delete(item)
    db.session.commit()
    return "", 204
