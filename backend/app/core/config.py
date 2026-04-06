import os
from pathlib import Path

from dotenv import load_dotenv

_env_path = Path(__file__).resolve().parent.parent.parent / ".env"
load_dotenv(_env_path)

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///sentimentsignal.db")
FINNHUB_API_KEY = os.getenv("FINNHUB_API_KEY", "")
NEWSAPI_API_KEY = os.getenv("NEWSAPI_API_KEY", "")
INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY", "dev-secret-key")
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-change-in-prod")
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-jwt-secret-change-in-prod")

RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
MAIL_FROM = os.getenv("MAIL_FROM", "SentimentSignal <onboarding@resend.dev>")

# Legacy SMTP fallback (unused when RESEND_API_KEY is set)
MAIL_SERVER = os.getenv("MAIL_SERVER", "smtp.gmail.com")
MAIL_PORT = int(os.getenv("MAIL_PORT", "587"))
MAIL_USE_TLS = os.getenv("MAIL_USE_TLS", "true").lower() == "true"
MAIL_USERNAME = os.getenv("MAIL_USERNAME", "")
MAIL_PASSWORD = os.getenv("MAIL_PASSWORD", "")
MAIL_SENDER = os.getenv("MAIL_SENDER", MAIL_FROM)
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")


def log_config_status():
    print(f"[config] .env path: {_env_path} (exists={_env_path.exists()})")
    print(f"[config] FINNHUB_API_KEY: {'set (' + FINNHUB_API_KEY[:4] + '...)' if FINNHUB_API_KEY else 'MISSING'}")
    print(f"[config] NEWSAPI_API_KEY: {'set' if NEWSAPI_API_KEY else 'not set (optional)'}")
    print(f"[config] DATABASE_URL: {DATABASE_URL}")
