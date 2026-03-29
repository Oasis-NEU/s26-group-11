from datetime import datetime, timezone
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class Stock(db.Model):
    __tablename__ = "stocks"

    id = db.Column(db.Integer, primary_key=True)
    symbol = db.Column(db.String(10), unique=True, nullable=False, index=True)
    name = db.Column(db.String(200))
    exchange = db.Column(db.String(20))         # NYSE, NASDAQ, AMEX
    tier = db.Column(db.Integer, default=3)     # 1=top100, 2=mid1000, 3=long-tail
    last_scraped_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    sentiments = db.relationship("HourlySentiment", back_populates="stock", lazy="dynamic")
    mentions = db.relationship("Mention", back_populates="stock", lazy="dynamic")

    def to_dict(self):
        return {
            "symbol": self.symbol,
            "name": self.name,
            "exchange": self.exchange,
            "tier": self.tier,
        }


class HourlySentiment(db.Model):
    """Aggregated sentiment snapshot per stock per hour."""
    __tablename__ = "hourly_sentiment"

    id = db.Column(db.Integer, primary_key=True)
    stock_id = db.Column(db.Integer, db.ForeignKey("stocks.id"), nullable=False, index=True)
    timestamp = db.Column(db.DateTime, nullable=False, index=True)

    # Overall weighted score: -1.0 (very negative) → 1.0 (very positive)
    overall_score = db.Column(db.Float)
    reddit_score = db.Column(db.Float)
    twitter_score = db.Column(db.Float)
    news_score = db.Column(db.Float)

    reddit_mentions = db.Column(db.Integer, default=0)
    twitter_mentions = db.Column(db.Integer, default=0)
    news_mentions = db.Column(db.Integer, default=0)

    stock = db.relationship("Stock", back_populates="sentiments")

    __table_args__ = (
        db.UniqueConstraint("stock_id", "timestamp", name="uq_sentiment_stock_hour"),
    )


class Mention(db.Model):
    """Individual credible mention from any source."""
    __tablename__ = "mentions"

    id = db.Column(db.Integer, primary_key=True)
    stock_id = db.Column(db.Integer, db.ForeignKey("stocks.id"), nullable=False, index=True)

    source = db.Column(db.String(20), nullable=False)   # "reddit" | "twitter" | "news"
    external_id = db.Column(db.String(200), unique=True)  # Reddit post/comment id, tweet id, article url

    text = db.Column(db.Text, nullable=False)
    url = db.Column(db.String(500))

    # Author metadata
    author = db.Column(db.String(200))
    author_followers = db.Column(db.Integer)
    author_verified = db.Column(db.Boolean, default=False)
    author_account_age_days = db.Column(db.Integer)
    author_karma = db.Column(db.Integer)      # Reddit only

    # Engagement
    upvotes = db.Column(db.Integer, default=0)
    comments = db.Column(db.Integer, default=0)
    subreddit = db.Column(db.String(100))     # Reddit only
    news_source = db.Column(db.String(100))   # News only (e.g. "bloomberg")

    # Scoring
    credibility_score = db.Column(db.Float, nullable=False)
    sentiment_score = db.Column(db.Float)     # -1.0 → 1.0
    sentiment_label = db.Column(db.String(20))  # "positive" | "neutral" | "negative"
    sentiment_model = db.Column(db.String(20))  # "vader" | "finbert"

    published_at = db.Column(db.DateTime, nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    stock = db.relationship("Stock", back_populates="mentions")

    def to_dict(self):
        return {
            "id": self.id,
            "source": self.source,
            "text": self.text,
            "url": self.url,
            "author": self.author,
            "author_verified": self.author_verified,
            "author_followers": self.author_followers,
            "upvotes": self.upvotes,
            "subreddit": self.subreddit,
            "news_source": self.news_source,
            "credibility_score": self.credibility_score,
            "sentiment_score": self.sentiment_score,
            "sentiment_label": self.sentiment_label,
            "published_at": self.published_at.isoformat(),
        }


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255))   # Null for OAuth-only users
    google_id = db.Column(db.String(100), unique=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    watchlist_items = db.relationship("WatchlistItem", back_populates="user", lazy="dynamic")

    def to_dict(self):
        return {"id": self.id, "email": self.email}


class WatchlistItem(db.Model):
    __tablename__ = "watchlist_items"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    symbol = db.Column(db.String(10), nullable=False)
    added_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    user = db.relationship("User", back_populates="watchlist_items")

    __table_args__ = (
        db.UniqueConstraint("user_id", "symbol", name="uq_watchlist_user_symbol"),
    )
