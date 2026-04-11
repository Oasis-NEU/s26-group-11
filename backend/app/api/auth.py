from flask import Blueprint, jsonify, make_response, request
from flask_jwt_extended import (
    create_access_token,
    get_jwt_identity,
    jwt_required,
    set_access_cookies,
    unset_jwt_cookies,
)
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired

from app.core import config
from app.core.mail import send_email, send_welcome_email
from app.db.models import User
from app.extensions import bcrypt, db

_RESET_SALT = "password-reset"


def _reset_serializer():
    return URLSafeTimedSerializer(config.SECRET_KEY)

auth_bp = Blueprint("auth", __name__)


def _iso(dt) -> str | None:
    """ISO-8601 with explicit UTC 'Z' so JavaScript parses it as UTC, not local time."""
    if dt is None:
        return None
    s = dt.isoformat()
    if "+" not in s and not s.endswith("Z"):
        s += "Z"
    return s


def _user_dict(user):
    return {
        "id":          user.id,
        "email":       user.email,
        "username":    user.username,
        "first_name":  user.first_name,
        "last_name":   user.last_name,
        "bio":         user.bio,
        "avatar_url":  user.avatar_url,
        "created_at":  _iso(user.created_at),
    }


@auth_bp.route("/register", methods=["POST"])
def register_request():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    username = (data.get("username") or "").strip() or None

    if not email or not password:
        return jsonify(error="Email and password are required"), 400
    if len(password) < 8:
        return jsonify(error="Password must be at least 8 characters"), 400
    if User.query.filter_by(email=email).first():
        return jsonify(error="Email already registered"), 409
    if username:
        if len(username) < 3:
            return jsonify(error="Username must be at least 3 characters"), 400
        if User.query.filter_by(username=username).first():
            return jsonify(error="Username already taken"), 409

    # Create account immediately — no OTP step required.
    # Welcome email is sent asynchronously (non-fatal if it fails).
    pw_hash = bcrypt.generate_password_hash(password).decode("utf-8")
    user = User(email=email, password_hash=pw_hash, username=username)
    db.session.add(user)
    db.session.commit()

    send_welcome_email(email, username or "")

    jwt_token = create_access_token(identity=str(user.id))
    resp = make_response(jsonify(**_user_dict(user)), 201)
    set_access_cookies(resp, jwt_token)
    return resp


@auth_bp.route("/register/verify", methods=["POST"])
def register_verify():
    data = request.get_json() or {}
    token = data.get("token") or ""
    otp_input = (data.get("otp") or "").strip()

    if not token or not otp_input:
        return jsonify(error="Token and verification code are required"), 400

    try:
        payload_str = _otp_serializer().loads(token, salt=_OTP_SALT, max_age=_OTP_MAX_AGE)
    except SignatureExpired:
        return jsonify(error="Verification code expired. Please register again."), 400
    except BadSignature:
        return jsonify(error="Invalid token."), 400

    try:
        payload = json.loads(payload_str)
    except Exception:
        return jsonify(error="Invalid token."), 400

    if payload.get("otp") != otp_input:
        return jsonify(error="Incorrect verification code. Please try again."), 400

    email    = payload["email"]
    username = payload.get("username")
    pw_hash  = payload["pw_hash"]

    # Guard against race conditions
    if User.query.filter_by(email=email).first():
        return jsonify(error="Email already registered"), 409
    if username and User.query.filter_by(username=username).first():
        return jsonify(error="Username already taken"), 409

    user = User(email=email, password_hash=pw_hash, username=username)
    db.session.add(user)
    db.session.commit()

    send_welcome_email(email, username or "")

    jwt_token = create_access_token(identity=str(user.id))
    resp = make_response(jsonify(**_user_dict(user)), 201)
    set_access_cookies(resp, jwt_token)
    return resp


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    user = User.query.filter_by(email=email).first()
    if not user or not bcrypt.check_password_hash(user.password_hash, password):
        return jsonify(error="Invalid email or password"), 401

    token = create_access_token(identity=str(user.id))
    resp = make_response(jsonify(**_user_dict(user)))
    set_access_cookies(resp, token)
    return resp


@auth_bp.route("/me")
@jwt_required()
def me():
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    if not user:
        return jsonify(error="User not found"), 404
    return jsonify(**_user_dict(user))


@auth_bp.route("/logout", methods=["POST"])
def logout():
    resp = make_response(jsonify(message="Logged out"))
    unset_jwt_cookies(resp)
    return resp


@auth_bp.route("/profile", methods=["PUT"])
@jwt_required()
def update_profile():
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    if not user:
        return jsonify(error="User not found"), 404

    data = request.get_json() or {}
    new_password = data.get("new_password") or ""
    current_password = data.get("current_password") or ""

    # ── Profile info ──────────────────────────────────────────────────────────
    if "first_name" in data:
        user.first_name = (data["first_name"] or "").strip()[:100] or None
    if "last_name" in data:
        user.last_name = (data["last_name"] or "").strip()[:100] or None
    if "bio" in data:
        user.bio = (data["bio"] or "").strip()[:500] or None
    if "avatar_url" in data:
        # Accept base64 data-URL or clear (None/empty)
        av = data["avatar_url"]
        user.avatar_url = av if av else None

    # ── Username ─────────────────────────────────────────────────────────────
    if "username" in data:
        username = (data["username"] or "").strip()
        if not username:
            return jsonify(error="Username cannot be empty"), 400
        if len(username) < 3:
            return jsonify(error="Username must be at least 3 characters"), 400
        if len(username) > 80:
            return jsonify(error="Username too long (max 80 chars)"), 400
        conflict = User.query.filter(User.username == username, User.id != user_id).first()
        if conflict:
            return jsonify(error="Username already taken"), 409
        user.username = username

    if new_password:
        if not current_password:
            return jsonify(error="Current password is required"), 400
        if not bcrypt.check_password_hash(user.password_hash, current_password):
            return jsonify(error="Current password is incorrect"), 401
        if len(new_password) < 8:
            return jsonify(error="New password must be at least 8 characters"), 400
        user.password_hash = bcrypt.generate_password_hash(new_password).decode("utf-8")

    db.session.commit()
    return jsonify(**_user_dict(user))


@auth_bp.route("/forgot-password", methods=["POST"])
def forgot_password():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    if not email:
        return jsonify(error="Email is required"), 400

    user = User.query.filter_by(email=email).first()
    # Always return 200 to avoid leaking which emails exist
    if not user:
        return jsonify(message="If that email is registered, a reset link has been sent."), 200

    token = _reset_serializer().dumps(email, salt=_RESET_SALT)
    reset_url = f"{config.FRONTEND_URL}/reset-password?token={token}"

    html = f"""
    <div style="font-family:monospace;max-width:480px;margin:0 auto;padding:32px;background:#0a0a0a;color:#e5e5e5">
      <h2 style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#22c55e;margin:0 0 24px">
        SentimentSignal
      </h2>
      <p style="font-size:14px;margin:0 0 16px">You requested a password reset.</p>
      <p style="font-size:12px;color:#888;margin:0 0 24px">This link expires in 1 hour.</p>
      <a href="{reset_url}"
         style="display:inline-block;padding:12px 24px;background:#22c55e;color:#0a0a0a;
                font-size:11px;font-weight:900;letter-spacing:0.1em;text-transform:uppercase;
                text-decoration:none">
        Reset Password →
      </a>
      <p style="font-size:11px;color:#555;margin:32px 0 0">
        If you didn't request this, ignore this email.
      </p>
    </div>
    """

    try:
        send_email(email, "Reset your SentimentSignal password", html)
    except RuntimeError:
        # Email not configured — in dev, return the token directly so the flow can still be tested
        return jsonify(
            message="Email not configured. Use this token to test the reset flow.",
            dev_token=token,
        ), 200

    return jsonify(message="If that email is registered, a reset link has been sent."), 200


@auth_bp.route("/reset-password", methods=["POST"])
def reset_password():
    data = request.get_json() or {}
    token = data.get("token") or ""
    new_password = data.get("new_password") or ""

    if not token or not new_password:
        return jsonify(error="Token and new password are required"), 400
    if len(new_password) < 8:
        return jsonify(error="Password must be at least 8 characters"), 400

    try:
        email = _reset_serializer().loads(token, salt=_RESET_SALT, max_age=3600)
    except SignatureExpired:
        return jsonify(error="Reset link has expired. Please request a new one."), 400
    except BadSignature:
        return jsonify(error="Invalid or tampered reset link."), 400

    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify(error="User not found"), 404

    user.password_hash = bcrypt.generate_password_hash(new_password).decode("utf-8")
    db.session.commit()

    return jsonify(message="Password updated. You can now sign in."), 200
