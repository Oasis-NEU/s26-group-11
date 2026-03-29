import enum
from datetime import datetime, timezone

from app.extensions import db


class SourceType(str, enum.Enum):
    news = "news"
    reddit = "reddit"
    twitter = "twitter"


class Stock(db.Model):
    __tablename__ = "stocks"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    ticker = db.Column(db.String(10), unique=True, nullable=False, index=True)
    name = db.Column(db.String(255), nullable=True)


class Mention(db.Model):
    __tablename__ = "mentions"
    __table_args__ = (db.UniqueConstraint("url", name="uq_mentions_url"),)

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    ticker = db.Column(db.String(10), nullable=False, index=True)
    source_type = db.Column(db.String(20), nullable=False)
    title = db.Column(db.Text, nullable=False)
    summary = db.Column(db.Text, nullable=True)
    url = db.Column(db.Text, nullable=False)
    source_domain = db.Column(db.String(255), nullable=False)
    published_at = db.Column(db.DateTime, nullable=False)
    credibility_score = db.Column(db.Integer, nullable=False, default=0)
    raw_provider = db.Column(db.String(50), nullable=False)
    created_at = db.Column(
        db.DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
