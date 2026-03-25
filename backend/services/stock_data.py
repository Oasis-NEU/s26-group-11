"""
Fetches current stock price and fundamentals via yfinance.
Aggressively cached — price data updates every 15 minutes.
"""

from datetime import datetime, timezone
import yfinance as yf


def get_stock_info(symbol: str) -> dict | None:
    """
    Returns basic stock info dict or None if not found.
    """
    try:
        ticker = yf.Ticker(symbol)
        info = ticker.info

        if not info or info.get("regularMarketPrice") is None:
            # Fallback: try fast_info
            fast = ticker.fast_info
            price = fast.last_price
            if price is None:
                return None
            return {
                "symbol": symbol.upper(),
                "name": info.get("longName") or info.get("shortName") or symbol,
                "price": round(price, 2),
                "change": None,
                "change_pct": None,
                "market_cap": fast.market_cap,
                "volume": fast.three_month_average_volume,
                "exchange": fast.exchange,
            }

        price = info.get("regularMarketPrice") or info.get("currentPrice", 0)
        prev_close = info.get("regularMarketPreviousClose") or info.get("previousClose", price)
        change = round(price - prev_close, 2)
        change_pct = round((change / prev_close) * 100, 2) if prev_close else 0.0

        return {
            "symbol": symbol.upper(),
            "name": info.get("longName") or info.get("shortName") or symbol,
            "price": round(price, 2),
            "change": change,
            "change_pct": change_pct,
            "market_cap": info.get("marketCap"),
            "volume": info.get("regularMarketVolume") or info.get("volume"),
            "exchange": info.get("exchange") or info.get("market"),
        }
    except Exception:
        return None


def search_tickers(query: str, limit: int = 10) -> list[dict]:
    """
    Basic ticker autocomplete using yfinance.
    Returns list of {symbol, name} dicts.
    """
    try:
        results = yf.Search(query, max_results=limit)
        quotes = results.quotes or []
        return [
            {
                "symbol": q.get("symbol", ""),
                "name": q.get("longname") or q.get("shortname") or q.get("symbol", ""),
                "exchange": q.get("exchange", ""),
            }
            for q in quotes
            if q.get("symbol")
        ]
    except Exception:
        return []
