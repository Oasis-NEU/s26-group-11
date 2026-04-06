from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.extensions import db
from app.db.models import Portfolio, PortfolioItem

portfolio_bp = Blueprint("portfolio", __name__)


def _get_or_create_portfolio(uid: int) -> Portfolio:
    p = Portfolio.query.filter_by(user_id=uid).first()
    if not p:
        p = Portfolio(user_id=uid)
        db.session.add(p)
        db.session.flush()
    return p


def _item_dict(item: PortfolioItem) -> dict:
    return {
        "id": item.id,
        "ticker": item.ticker,
        "shares": item.shares,
        "avg_cost": item.avg_cost,
        "added_at": item.added_at.isoformat(),
    }


@portfolio_bp.route("", methods=["GET"])
@jwt_required()
def get_portfolio():
    uid = int(get_jwt_identity())
    p = _get_or_create_portfolio(uid)
    db.session.commit()
    return jsonify([_item_dict(i) for i in p.items])


@portfolio_bp.route("", methods=["POST"])
@jwt_required()
def add_position():
    uid = int(get_jwt_identity())
    data = request.get_json() or {}
    ticker = (data.get("ticker") or "").strip().upper()
    shares = data.get("shares")
    avg_cost = data.get("avg_cost")
    if not ticker:
        return jsonify({"error": "ticker required"}), 400
    try:
        shares = float(shares)
        avg_cost = float(avg_cost)
    except (TypeError, ValueError):
        return jsonify({"error": "shares and avg_cost must be numbers"}), 400

    p = _get_or_create_portfolio(uid)
    existing = PortfolioItem.query.filter_by(portfolio_id=p.id, ticker=ticker).first()
    if existing:
        # Weighted average the cost
        total_shares = existing.shares + shares
        existing.avg_cost = ((existing.avg_cost * existing.shares) + (avg_cost * shares)) / total_shares
        existing.shares = total_shares
        db.session.commit()
        return jsonify(_item_dict(existing))

    item = PortfolioItem(portfolio_id=p.id, ticker=ticker, shares=shares, avg_cost=avg_cost)
    db.session.add(item)
    db.session.commit()
    return jsonify(_item_dict(item)), 201


@portfolio_bp.route("/<int:item_id>", methods=["PUT"])
@jwt_required()
def update_position(item_id: int):
    uid = int(get_jwt_identity())
    p = Portfolio.query.filter_by(user_id=uid).first_or_404()
    item = PortfolioItem.query.filter_by(id=item_id, portfolio_id=p.id).first_or_404()
    data = request.get_json() or {}
    if "shares" in data:
        item.shares = float(data["shares"])
    if "avg_cost" in data:
        item.avg_cost = float(data["avg_cost"])
    db.session.commit()
    return jsonify(_item_dict(item))


@portfolio_bp.route("/<int:item_id>", methods=["DELETE"])
@jwt_required()
def remove_position(item_id: int):
    uid = int(get_jwt_identity())
    p = Portfolio.query.filter_by(user_id=uid).first_or_404()
    item = PortfolioItem.query.filter_by(id=item_id, portfolio_id=p.id).first_or_404()
    db.session.delete(item)
    db.session.commit()
    return jsonify({"deleted": item_id})
