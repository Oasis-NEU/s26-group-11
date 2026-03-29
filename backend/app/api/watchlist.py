from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.db.models import WatchlistItem
from app.extensions import db

watchlist_bp = Blueprint("watchlist", __name__)


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


@watchlist_bp.route("/<ticker>", methods=["DELETE"])
@jwt_required()
def remove_from_watchlist(ticker):
    user_id = int(get_jwt_identity())
    item = WatchlistItem.query.filter_by(user_id=user_id, ticker=ticker.upper()).first_or_404()
    db.session.delete(item)
    db.session.commit()
    return "", 204
