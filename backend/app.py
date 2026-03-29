import os
from flask import Flask
from flask_cors import CORS
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager

from config import config
from models import db
from routes.stocks import stocks_bp, cache
from routes.auth import auth_bp, bcrypt
from routes.watchlist import watchlist_bp


def create_app(config_name: str | None = None) -> Flask:
    if config_name is None:
        config_name = os.environ.get("FLASK_ENV", "development")

    app = Flask(__name__)
    app.config.from_object(config[config_name])

    # Extensions
    db.init_app(app)
    Migrate(app, db)
    JWTManager(app)
    bcrypt.init_app(app)
    cache.init_app(app)

    CORS(app, resources={r"/api/*": {"origins": "*"}})

    # Blueprints
    app.register_blueprint(stocks_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(watchlist_bp)

    # Health check
    @app.get("/health")
    def health():
        return {"status": "ok"}

    # Start background scheduler (not in testing)
    if config_name != "testing":
        from jobs.scheduler import start as start_scheduler
        start_scheduler(app)

    return app


if __name__ == "__main__":
    app = create_app()
    with app.app_context():
        db.create_all()
    app.run(debug=True, port=5001)
