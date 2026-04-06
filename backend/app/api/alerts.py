from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.extensions import db
from app.db.models import PriceAlert

alerts_bp = Blueprint("alerts", __name__)


def _alert_dict(a: PriceAlert) -> dict:
    return {
        "id": a.id,
        "ticker": a.ticker,
        "target_price": a.target_price,
        "direction": a.direction,
        "triggered": a.triggered,
        "created_at": a.created_at.isoformat(),
        "triggered_at": a.triggered_at.isoformat() if a.triggered_at else None,
    }


@alerts_bp.route("", methods=["GET"])
@jwt_required()
def list_alerts():
    uid = int(get_jwt_identity())
    alerts = PriceAlert.query.filter_by(user_id=uid).order_by(PriceAlert.created_at.desc()).all()
    return jsonify([_alert_dict(a) for a in alerts])


@alerts_bp.route("", methods=["POST"])
@jwt_required()
def create_alert():
    uid = int(get_jwt_identity())
    data = request.get_json() or {}
    ticker = (data.get("ticker") or "").strip().upper()
    target_price = data.get("target_price")
    direction = data.get("direction", "above")
    if not ticker:
        return jsonify({"error": "ticker required"}), 400
    if direction not in ("above", "below"):
        return jsonify({"error": "direction must be 'above' or 'below'"}), 400
    try:
        target_price = float(target_price)
    except (TypeError, ValueError):
        return jsonify({"error": "target_price must be a number"}), 400

    alert = PriceAlert(user_id=uid, ticker=ticker, target_price=target_price, direction=direction)
    db.session.add(alert)
    db.session.commit()
    return jsonify(_alert_dict(alert)), 201


@alerts_bp.route("/<int:alert_id>", methods=["DELETE"])
@jwt_required()
def delete_alert(alert_id: int):
    uid = int(get_jwt_identity())
    alert = PriceAlert.query.filter_by(id=alert_id, user_id=uid).first_or_404()
    db.session.delete(alert)
    db.session.commit()
    return jsonify({"deleted": alert_id})
