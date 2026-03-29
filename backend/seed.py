"""
Seed the database with top stocks and run an initial news ingest.

Usage:
    cd backend
    python seed.py
"""

import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from app import create_app
from app.extensions import db
from app.db.models import Stock
from app.services.news.pipeline import ingest_news_for_ticker

TOP_100_TICKERS = [
    "AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "TSLA", "AVGO", "BRK-B", "JPM",
    "LLY", "UNH", "V", "XOM", "MA", "JNJ", "COST", "HD", "PG", "ABBV",
    "BAC", "MRK", "KO", "CRM", "CVX", "NFLX", "ORCL", "AMD", "TMO", "WMT",
    "MCD", "ACN", "LIN", "CSCO", "ABT", "ADBE", "PEP", "TXN", "PM", "GE",
    "IBM", "DHR", "ISRG", "CAT", "NOW", "INTU", "RTX", "UBER", "BKNG", "SPGI",
    "AMGN", "GS", "PFE", "AXP", "MS", "BLK", "SYK", "SCHW", "T", "LOW",
    "VRTX", "GILD", "MU", "DE", "ELV", "ADI", "REGN", "MDT", "PLD", "BSX",
    "MMC", "CB", "PANW", "HCA", "ZTS", "KKR", "LRCX", "NKE", "SHW", "TJX",
    "SO", "ICE", "CME", "INTC", "PNC", "USB", "EOG", "ETN", "APH", "WFC",
    "COP", "MO", "CI", "CEG", "DUK", "NOC", "GD", "WELL", "AON", "HUM",
]


def seed_stocks(app):
    with app.app_context():
        added = 0
        for ticker in TOP_100_TICKERS:
            if not Stock.query.filter_by(ticker=ticker).first():
                db.session.add(Stock(ticker=ticker))
                added += 1
        db.session.commit()
        print(f"[seed] Added {added} new stocks ({len(TOP_100_TICKERS) - added} already existed)")


def run_ingest(app, tickers: list[str]):
    print(f"[seed] Starting news ingest for {len(tickers)} tickers...")
    with app.app_context():
        total = 0
        for i, ticker in enumerate(tickers):
            try:
                dtos = ingest_news_for_ticker(ticker, days=7)
                total += len(dtos)
                if dtos:
                    print(f"  [{i+1}/{len(tickers)}] {ticker}: {len(dtos)} articles ingested")
            except Exception as e:
                print(f"  [{i+1}/{len(tickers)}] {ticker}: ERROR - {e}")
        print(f"[seed] Done. {total} total articles ingested.")


if __name__ == "__main__":
    app = create_app()
    seed_stocks(app)

    # Ingest news for the top 20 most-watched tickers to bootstrap the dashboard
    bootstrap_tickers = TOP_100_TICKERS[:20]
    run_ingest(app, bootstrap_tickers)
