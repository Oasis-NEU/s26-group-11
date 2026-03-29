"""
APScheduler configuration.
Jobs:
  - Every hour:   tier-1 stocks (top 100)
  - Every 6h:     tier-2 stocks (101–1000)
  - Every 24h:    tier-3 stocks (long-tail)
"""

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

_scheduler = BackgroundScheduler()


def _run_tier1():
    from jobs.pipeline import run_tier
    run_tier(tier=1, hours_back=1)


def _run_tier2():
    from jobs.pipeline import run_tier
    run_tier(tier=2, hours_back=6)


def _run_tier3():
    from jobs.pipeline import run_tier
    run_tier(tier=3, hours_back=24)


def start(app):
    """Start the scheduler within the Flask app context."""

    def with_context(fn):
        def wrapper():
            with app.app_context():
                fn()
        wrapper.__name__ = fn.__name__
        return wrapper

    _scheduler.add_job(
        with_context(_run_tier1),
        trigger=IntervalTrigger(hours=1),
        id="tier1_hourly",
        replace_existing=True,
    )
    _scheduler.add_job(
        with_context(_run_tier2),
        trigger=IntervalTrigger(hours=6),
        id="tier2_6h",
        replace_existing=True,
    )
    _scheduler.add_job(
        with_context(_run_tier3),
        trigger=IntervalTrigger(hours=24),
        id="tier3_daily",
        replace_existing=True,
    )

    _scheduler.start()


def stop():
    if _scheduler.running:
        _scheduler.shutdown(wait=False)
