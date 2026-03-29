from flask import Flask
from flask_cors import CORS

from app.core import config


def create_app():
    config.log_config_status()

    app = Flask(__name__)

    app.config["SQLALCHEMY_DATABASE_URI"] = config.DATABASE_URL
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["SECRET_KEY"] = config.SECRET_KEY
    app.config["JWT_SECRET_KEY"] = config.JWT_SECRET_KEY

    CORS(app, origins=["http://localhost:5173"])

    from app.extensions import bcrypt, db, jwt

    db.init_app(app)
    bcrypt.init_app(app)
    jwt.init_app(app)

    from app.api.health import health_bp
    from app.api.news import news_bp
    from app.api.auth import auth_bp
    from app.api.stocks import stocks_bp
    from app.api.watchlist import watchlist_bp

    app.register_blueprint(health_bp)
    app.register_blueprint(news_bp)
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(stocks_bp, url_prefix="/api/stocks")
    app.register_blueprint(watchlist_bp, url_prefix="/api/watchlist")

    with app.app_context():
        from app.db import models  # noqa: F401

        db.create_all()

    return app
