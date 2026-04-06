"""
NLP migration — adds new columns and tables for the 5 NLP features.

Run once:
    cd backend
    source .venv/bin/activate
    python scripts/migrate_nlp.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app import create_app
from app.extensions import db

MIGRATIONS = [
    # Mention new columns
    "ALTER TABLE mentions ADD COLUMN IF NOT EXISTS event_type VARCHAR(50)",
    "ALTER TABLE mentions ADD COLUMN IF NOT EXISTS event_confidence FLOAT",
    "ALTER TABLE mentions ADD COLUMN IF NOT EXISTS subreddit VARCHAR(50)",
    "CREATE INDEX IF NOT EXISTS ix_mentions_event_type ON mentions (event_type)",
    # Thread / Comment sentiment
    "ALTER TABLE threads  ADD COLUMN IF NOT EXISTS sentiment_score FLOAT",
    "ALTER TABLE comments ADD COLUMN IF NOT EXISTS sentiment_score FLOAT",
    # Sentiment snapshots table
    """
    CREATE TABLE IF NOT EXISTS sentiment_snapshots (
        id              SERIAL PRIMARY KEY,
        ticker          VARCHAR(10) NOT NULL,
        date            DATE NOT NULL,
        score           FLOAT,
        mention_count   INTEGER NOT NULL DEFAULT 0,
        avg_credibility FLOAT,
        source_type     VARCHAR(20) NOT NULL DEFAULT 'news',
        CONSTRAINT uq_snapshot_ticker_date UNIQUE (ticker, date)
    )
    """,
    "CREATE INDEX IF NOT EXISTS ix_sentiment_snapshots_ticker ON sentiment_snapshots (ticker)",
]


def run():
    app = create_app()
    with app.app_context():
        with db.engine.connect() as conn:
            for sql in MIGRATIONS:
                sql = sql.strip()
                if sql:
                    print(f"  -> {sql[:80]}...")
                    conn.execute(db.text(sql))
                    conn.commit()
        print("NLP migrations complete")


if __name__ == "__main__":
    run()
