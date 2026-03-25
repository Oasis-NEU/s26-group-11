"""
Watchlist endpoints (requires auth).

GET    /api/watchlist          — list user's watchlist
POST   /api/watchlist          — add a symbol
DELETE /api/watchlist/<symbol> — remove a symbol
"""

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from models import db, User, WatchlistItem, Stock
from services.stock_data import get_stock_info

watchlist_bp = Blueprint("watchlist", __name__, url_prefix="/api/watchlist")


@watchlist_bp.get("")
@jwt_required()
def get_watchlist():
    user_id = int(get_jwt_identity())
    items = WatchlistItem.query.filter_by(user_id=user_id).order_by(WatchlistItem.added_at).all()

    result = []
    for item in items:
        info = get_stock_info(item.symbol) or {}
        result.append({
            "symbol": item.symbol,
            "added_at": item.added_at.isoformat(),
            **info,
        })

    return jsonify(result)


@watchlist_bp.post("")
@jwt_required()
def add_to_watchlist():
    user_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}
    symbol = (data.get("symbol") or "").strip().upper()

    if not symbol:
        return jsonify({"error": "Symbol is required"}), 400

    existing = WatchlistItem.query.filter_by(user_id=user_id, symbol=symbol).first()
    if existing:
        return jsonify({"error": "Already in watchlist"}), 409

    # Ensure stock exists in our DB
    stock = Stock.query.filter_by(symbol=symbol).first()
    if not stock:
        stock = Stock(symbol=symbol, tier=3)
        db.session.add(stock)

    item = WatchlistItem(user_id=user_id, symbol=symbol)
    db.session.add(item)
    db.session.commit()

    return jsonify({"symbol": symbol}), 201


@watchlist_bp.delete("/<symbol>")
@jwt_required()
def remove_from_watchlist(symbol: str):
    user_id = int(get_jwt_identity())
    symbol = symbol.upper()

    item = WatchlistItem.query.filter_by(user_id=user_id, symbol=symbol).first()
    if not item:
        return jsonify({"error": "Not in watchlist"}), 404

    db.session.delete(item)
    db.session.commit()
    return "", 204
