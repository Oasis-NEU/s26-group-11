"""
Integration tests for the Flask API endpoints.

Uses Flask's built-in test client — no real HTTP calls.
Finnhub and yfinance calls are mocked so tests run offline.
"""

from unittest.mock import patch, MagicMock

import pytest

from app import create_app


@pytest.fixture
def app():
    """Create a fresh app instance configured for testing."""
    application = create_app()
    application.config.update({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
    })
    return application


@pytest.fixture
def client(app):
    return app.test_client()


# ── /api/stocks/search ────────────────────────────────────────────────────────

class TestSearch:
    def test_empty_query_returns_empty(self, client):
        r = client.get("/api/stocks/search?q=")
        assert r.status_code == 200
        assert r.get_json() == []

    def test_single_char_query_returns_empty(self, client):
        r = client.get("/api/stocks/search?q=A")
        assert r.status_code == 200
        assert r.get_json() == []

    @patch("app.api.stocks.search_symbol")
    def test_returns_finnhub_results(self, mock_search, client):
        mock_search.return_value = [
            {"symbol": "AAPL", "name": "Apple Inc", "type": "Common Stock", "exchange": ""},
        ]
        r = client.get("/api/stocks/search?q=apple")
        assert r.status_code == 200
        data = r.get_json()
        symbols = [d["symbol"] for d in data]
        assert "AAPL" in symbols

    @patch("app.api.stocks.search_symbol")
    def test_deduplicates_results(self, mock_search, client):
        """Same symbol from DB and Finnhub should only appear once."""
        mock_search.return_value = [
            {"symbol": "TSLA", "name": "Tesla Inc", "type": "Common Stock", "exchange": ""},
        ]
        r = client.get("/api/stocks/search?q=TSLA")
        data = r.get_json()
        symbols = [d["symbol"] for d in data]
        assert symbols.count("TSLA") <= 1


# ── /api/stocks/<ticker> ──────────────────────────────────────────────────────

class TestStockDetail:
    @patch("app.api.stocks.get_quote")
    @patch("app.api.stocks.get_fundamentals")
    @patch("app.api.stocks.ingest_news_for_ticker")
    @patch("app.api.stocks.get_news_for_ticker")
    def test_invalid_ticker_returns_404(
        self, mock_news, mock_ingest, mock_fund, mock_quote, client
    ):
        """A ticker with no price data and no mentions should return 404."""
        mock_quote.return_value = {"price": None, "change_pct": None,
                                   "open": None, "day_high": None, "day_low": None}
        mock_fund.return_value = {}
        mock_news.return_value = []
        mock_ingest.return_value = None

        with patch("app.api.stocks.search_symbol", return_value=[]):
            r = client.get("/api/stocks/XYZFAKE")

        assert r.status_code == 404
        body = r.get_json()
        assert body["error"] == "ticker_not_found"
        assert body["ticker"] == "XYZFAKE"

    @patch("app.api.stocks.get_quote")
    @patch("app.api.stocks.get_fundamentals")
    @patch("app.api.stocks.ingest_news_for_ticker")
    @patch("app.api.stocks.get_news_for_ticker")
    def test_valid_ticker_returns_200(
        self, mock_news, mock_ingest, mock_fund, mock_quote, client
    ):
        """A ticker with price data should return a 200 with the expected shape."""
        mock_quote.return_value = {
            "price": 182.50, "change_pct": 1.2,
            "open": 180.0, "day_high": 183.0, "day_low": 179.5,
        }
        mock_fund.return_value = {
            "name": "Apple Inc",
            "market_cap": 2_800_000_000_000,
            "pe_ratio": 28.5,
        }
        mock_news.return_value = []
        mock_ingest.return_value = None

        r = client.get("/api/stocks/AAPL")
        assert r.status_code == 200

        body = r.get_json()
        assert body["ticker"] == "AAPL"
        assert body["price"] == 182.50
        assert "sentiment" in body
        assert "history" in body
        assert "fundamentals" in body
