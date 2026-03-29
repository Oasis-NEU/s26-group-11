import os
from pathlib import Path

from dotenv import load_dotenv

_env_path = Path(__file__).resolve().parent.parent.parent / ".env"
load_dotenv(_env_path)

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///sentimentsignal.db")
FINNHUB_API_KEY = os.getenv("FINNHUB_API_KEY", "")
NEWSAPI_API_KEY = os.getenv("NEWSAPI_API_KEY", "")
INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY", "dev-secret-key")


def log_config_status():
    print(f"[config] .env path: {_env_path} (exists={_env_path.exists()})")
    print(f"[config] FINNHUB_API_KEY: {'set (' + FINNHUB_API_KEY[:4] + '...)' if FINNHUB_API_KEY else 'MISSING'}")
    print(f"[config] NEWSAPI_API_KEY: {'set' if NEWSAPI_API_KEY else 'not set (optional)'}")
    print(f"[config] DATABASE_URL: {DATABASE_URL}")
