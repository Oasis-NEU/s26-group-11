from flask import Flask
from flask_cors import CORS

from app.core import config


def create_app():
    config.log_config_status()

    app = Flask(__name__)

    app.config["SQLALCHEMY_DATABASE_URI"] = config.DATABASE_URL
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    CORS(app, origins=["http://localhost:5173"])

    from app.extensions import db

    db.init_app(app)

    from app.api.health import health_bp
    from app.api.news import news_bp

    app.register_blueprint(health_bp)
    app.register_blueprint(news_bp)

    with app.app_context():
        from app.db import models  # noqa: F401

        db.create_all()

    return app
