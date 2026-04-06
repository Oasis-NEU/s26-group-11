"""
Background scheduler — keeps trending tickers' news fresh automatically.

Strategy:
  Every INGEST_INTERVAL_MINUTES (default 30), we:
    1. Query the top N tickers by recent mention count.
    2. Ingest fresh news for each ticker (Finnhub + RSS + NewsAPI in parallel).
    3. Bust the in-process cache so the next API hit returns new data.

The scheduler runs in a daemon thread so it dies cleanly with the process.
It is safe to use under Flask's dev server (single-process) or any WSGI
server that runs a single worker process (Gunicorn --workers=1).
"""
from __future__ import annotations

import threading
import time
from datetime import datetime, timedelta, timezone

_started = False
_lock = threading.Lock()


def _run_cycle(app, top_n: int = 20) -> None:
    """Single ingest cycle — called inside app context."""
    from sqlalchemy import func
    from app.db.models import Mention
    from app.extensions import db
    from app.services.news.pipeline import ingest_news_for_ticker
    from app.core.cache import delete as cache_delete

    cutoff = datetime.now(timezone.utc) - timedelta(hours=72)

    try:
        rows = (
            db.session.query(Mention.ticker, func.count(Mention.id).label("cnt"))
            .filter(Mention.published_at >= cutoff)
            .group_by(Mention.ticker)
            .order_by(func.count(Mention.id).desc())
            .limit(top_n)
            .all()
        )
        tickers = [r[0] for r in rows]
    except Exception as exc:
        print(f"[scheduler] failed to query trending tickers: {exc}")
        return

    if not tickers:
        print("[scheduler] no trending tickers found, skipping cycle")
        return

    print(f"[scheduler] ingesting {len(tickers)} tickers: {', '.join(tickers)}")
    ok = 0
    from app.services.sentiment import snapshot_ticker
    for ticker in tickers:
        try:
            ingested = ingest_news_for_ticker(ticker, days=3)
            print(f"[scheduler]   {ticker}: +{len(ingested)} articles")
            try:
                snapshot_ticker(ticker)
            except Exception as snap_exc:
                print(f"[scheduler]   {ticker}: snapshot error — {snap_exc}")
            ok += 1
        except Exception as exc:
            print(f"[scheduler]   {ticker}: error — {exc}")

    # Bust top-level caches so next request reflects new data
    for key in ("feed", "trending", "shifters"):
        cache_delete(key)

    print(f"[scheduler] cycle done — {ok}/{len(tickers)} tickers refreshed")


def _scheduler_loop(app, interval_seconds: int) -> None:
    """Infinite loop that sleeps between cycles."""
    # Small initial delay so the app finishes starting up first
    time.sleep(15)
    while True:
        try:
            with app.app_context():
                _run_cycle(app)
        except Exception as exc:
            print(f"[scheduler] unexpected error in cycle: {exc}")
        time.sleep(interval_seconds)


def start(app, interval_minutes: int = 30) -> None:
    """
    Start the background scheduler thread (idempotent — safe to call multiple
    times; only the first call has any effect).
    """
    global _started
    with _lock:
        if _started:
            return
        _started = True

    interval_seconds = interval_minutes * 60
    thread = threading.Thread(
        target=_scheduler_loop,
        args=(app, interval_seconds),
        name="ss-scheduler",
        daemon=True,
    )
    thread.start()
    print(f"[scheduler] started — interval={interval_minutes}m, top_n=20")
