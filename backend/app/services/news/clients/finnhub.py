from datetime import date

import requests

from app.core import config

FINNHUB_BASE = "https://finnhub.io/api/v1"


def fetch_company_news(
    symbol: str,
    from_date: date,
    to_date: date,
) -> list[dict]:
    """Fetch company news from Finnhub for a given symbol and date range.

    Returns the raw JSON list from Finnhub's /company-news endpoint.
    Each item has: category, datetime, headline, id, image, related,
    source, summary, url.
    """
    if not config.FINNHUB_API_KEY:
        raise RuntimeError(
            "FINNHUB_API_KEY is not set. "
            "Add it to backend/.env or export it as an environment variable."
        )

    params = {
        "symbol": symbol.upper(),
        "from": from_date.isoformat(),
        "to": to_date.isoformat(),
        "token": config.FINNHUB_API_KEY,
    }
    resp = requests.get(
        f"{FINNHUB_BASE}/company-news", params=params, timeout=15
    )
    resp.raise_for_status()
    return resp.json()
