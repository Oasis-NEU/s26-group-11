import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-key")
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "dev-jwt-secret")

    _db_url = os.environ.get("DATABASE_URL", "sqlite:///sentimentsignal_dev.db")
    # SQLAlchemy 2.x requires postgresql+psycopg2:// not postgres://
    if _db_url.startswith("postgres://"):
        _db_url = _db_url.replace("postgres://", "postgresql://", 1)
    SQLALCHEMY_DATABASE_URI = _db_url
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    CACHE_TYPE = "RedisCache"
    CACHE_REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
    CACHE_DEFAULT_TIMEOUT = 3600

    # Reddit
    REDDIT_CLIENT_ID = os.environ.get("REDDIT_CLIENT_ID", "")
    REDDIT_CLIENT_SECRET = os.environ.get("REDDIT_CLIENT_SECRET", "")
    REDDIT_USER_AGENT = os.environ.get("REDDIT_USER_AGENT", "SentimentSignal/1.0")

    # News
    NEWS_API_KEY = os.environ.get("NEWS_API_KEY", "")
    FINNHUB_API_KEY = os.environ.get("FINNHUB_API_KEY", "")

    # HuggingFace (FinBERT)
    HUGGINGFACE_API_TOKEN = os.environ.get("HUGGINGFACE_API_TOKEN", "")

    # Google OAuth
    GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")

    # Sentiment tiers
    TOP_TIER_LIMIT = 100       # FinBERT + hourly refresh
    MID_TIER_LIMIT = 1000      # VADER + 6h refresh
    # Everything else: VADER + daily refresh

    # Credibility thresholds
    REDDIT_MIN_CREDIBILITY = 40
    TWITTER_MIN_CREDIBILITY = 50


class DevelopmentConfig(Config):
    DEBUG = True
    CACHE_TYPE = "SimpleCache"   # No Redis needed locally


class ProductionConfig(Config):
    DEBUG = False


config = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
    "default": DevelopmentConfig,
}
