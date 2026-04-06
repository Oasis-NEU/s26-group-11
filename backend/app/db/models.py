import enum
import json
from datetime import datetime, timezone

from app.extensions import db


class SourceType(str, enum.Enum):
    news    = "news"
    reddit  = "reddit"
    twitter = "twitter"


class Stock(db.Model):
    __tablename__ = "stocks"

    id     = db.Column(db.Integer, primary_key=True, autoincrement=True)
    ticker = db.Column(db.String(10), unique=True, nullable=False, index=True)
    name   = db.Column(db.String(255), nullable=True)


class User(db.Model):
    __tablename__ = "users"

    id            = db.Column(db.Integer, primary_key=True, autoincrement=True)
    email         = db.Column(db.String(255), unique=True, nullable=False, index=True)
    username      = db.Column(db.String(80), unique=True, nullable=True, index=True)
    first_name    = db.Column(db.String(100), nullable=True)
    last_name     = db.Column(db.String(100), nullable=True)
    bio           = db.Column(db.Text, nullable=True)
    avatar_url    = db.Column(db.Text, nullable=True)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at    = db.Column(db.DateTime, nullable=False,
                              default=lambda: datetime.now(timezone.utc))
    watchlist     = db.relationship("WatchlistItem", back_populates="user", lazy="dynamic")


class WatchlistItem(db.Model):
    __tablename__  = "watchlist_items"
    __table_args__ = (db.UniqueConstraint("user_id", "ticker", name="uq_watchlist_user_ticker"),)

    id       = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id  = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    ticker   = db.Column(db.String(10), nullable=False)
    added_at = db.Column(db.DateTime, nullable=False,
                         default=lambda: datetime.now(timezone.utc))
    user     = db.relationship("User", back_populates="watchlist")


class Thread(db.Model):
    __tablename__ = "threads"

    id              = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id         = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    ticker          = db.Column(db.String(10), nullable=True, index=True)
    title           = db.Column(db.String(300), nullable=False)
    body            = db.Column(db.Text, nullable=True)
    upvotes         = db.Column(db.Integer, nullable=False, default=0)
    edited_at       = db.Column(db.DateTime, nullable=True)
    sentiment_score = db.Column(db.Float, nullable=True)   # FinBERT score on title+body
    created_at      = db.Column(db.DateTime, nullable=False,
                                default=lambda: datetime.now(timezone.utc))

    user     = db.relationship("User", backref="threads")
    comments = db.relationship("Comment", back_populates="thread",
                               lazy="dynamic", cascade="all, delete-orphan")


class Comment(db.Model):
    __tablename__ = "comments"

    id              = db.Column(db.Integer, primary_key=True, autoincrement=True)
    thread_id       = db.Column(db.Integer, db.ForeignKey("threads.id"), nullable=False)
    user_id         = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    body            = db.Column(db.Text, nullable=False)
    upvotes         = db.Column(db.Integer, nullable=False, default=0)
    sentiment_score = db.Column(db.Float, nullable=True)   # FinBERT score on body
    created_at      = db.Column(db.DateTime, nullable=False,
                                default=lambda: datetime.now(timezone.utc))

    user   = db.relationship("User", backref="comments")
    thread = db.relationship("Thread", back_populates="comments")


class Mention(db.Model):
    __tablename__  = "mentions"
    __table_args__ = (db.UniqueConstraint("url", name="uq_mentions_url"),)

    id                = db.Column(db.Integer, primary_key=True, autoincrement=True)
    ticker            = db.Column(db.String(10), nullable=False, index=True)
    source_type       = db.Column(db.String(20), nullable=False)
    title             = db.Column(db.Text, nullable=False)
    summary           = db.Column(db.Text, nullable=True)
    url               = db.Column(db.Text, nullable=False)
    source_domain     = db.Column(db.String(255), nullable=False)
    published_at      = db.Column(db.DateTime, nullable=False)
    credibility_score = db.Column(db.Integer, nullable=False, default=0)
    sentiment_score   = db.Column(db.Float, nullable=True)
    raw_provider      = db.Column(db.String(50), nullable=False)
    event_type        = db.Column(db.String(50), nullable=True, index=True)
    event_confidence  = db.Column(db.Float, nullable=True)
    subreddit         = db.Column(db.String(50), nullable=True)
    upvotes           = db.Column(db.Integer, nullable=False, default=0)
    created_at        = db.Column(db.DateTime, nullable=False,
                                  default=lambda: datetime.now(timezone.utc))


class SentimentSnapshot(db.Model):
    """Daily per-ticker sentiment aggregate for trend tracking."""
    __tablename__  = "sentiment_snapshots"
    __table_args__ = (
        db.UniqueConstraint("ticker", "date", name="uq_snapshot_ticker_date"),
    )

    id              = db.Column(db.Integer, primary_key=True, autoincrement=True)
    ticker          = db.Column(db.String(10), nullable=False, index=True)
    date            = db.Column(db.Date, nullable=False)
    score           = db.Column(db.Float, nullable=True)
    mention_count   = db.Column(db.Integer, nullable=False, default=0)
    avg_credibility = db.Column(db.Float, nullable=True)
    source_type     = db.Column(db.String(20), nullable=False, default="news")  # "news" | "reddit" | "all"


# ─── Preferences ────────────────────────────────────────────────────────────

class UserPreference(db.Model):
    __tablename__ = "user_preferences"

    id                = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id           = db.Column(db.Integer, db.ForeignKey("users.id"), unique=True, nullable=False)
    accent_color      = db.Column(db.String(20), nullable=False, default="#22c55e")
    default_timeframe = db.Column(db.String(5),  nullable=False, default="1M")
    density           = db.Column(db.String(15), nullable=False, default="comfortable")
    hidden_sections   = db.Column(db.Text, nullable=False, default="[]")
    min_credibility   = db.Column(db.Integer, nullable=False, default=0)
    updated_at        = db.Column(db.DateTime, nullable=False,
                                  default=lambda: datetime.now(timezone.utc),
                                  onupdate=lambda: datetime.now(timezone.utc))

    user = db.relationship("User", backref=db.backref("preferences", uselist=False))

    def to_dict(self) -> dict:
        return {
            "accent_color":      self.accent_color,
            "default_timeframe": self.default_timeframe,
            "density":           self.density,
            "hidden_sections":   json.loads(self.hidden_sections or "[]"),
            "min_credibility":   self.min_credibility,
        }


class ClickEvent(db.Model):
    __tablename__ = "click_events"

    id         = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id    = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    ticker     = db.Column(db.String(10), nullable=False, index=True)
    clicked_at = db.Column(db.DateTime, nullable=False,
                           default=lambda: datetime.now(timezone.utc))
    user = db.relationship("User", backref="click_events")


class WatchlistList(db.Model):
    __tablename__ = "watchlist_lists"

    id         = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id    = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    name       = db.Column(db.String(100), nullable=False)
    is_public  = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.DateTime, nullable=False,
                           default=lambda: datetime.now(timezone.utc))

    user       = db.relationship("User", backref="watchlist_lists")
    list_items = db.relationship("WatchlistListItem", back_populates="watchlist_list",
                                  lazy="dynamic", cascade="all, delete-orphan")


class WatchlistListItem(db.Model):
    __tablename__  = "watchlist_list_items"
    __table_args__ = (db.UniqueConstraint("list_id", "ticker", name="uq_wli_list_ticker"),)

    id       = db.Column(db.Integer, primary_key=True, autoincrement=True)
    list_id  = db.Column(db.Integer, db.ForeignKey("watchlist_lists.id"), nullable=False)
    ticker   = db.Column(db.String(10), nullable=False)
    added_at = db.Column(db.DateTime, nullable=False,
                         default=lambda: datetime.now(timezone.utc))

    watchlist_list = db.relationship("WatchlistList", back_populates="list_items")


class Feedback(db.Model):
    __tablename__ = "feedback"

    id         = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id    = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    email      = db.Column(db.String(255), nullable=True)
    category   = db.Column(db.String(50), nullable=False)
    message    = db.Column(db.Text, nullable=False)
    rating     = db.Column(db.Integer, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False,
                           default=lambda: datetime.now(timezone.utc))


class ThreadVote(db.Model):
    __tablename__  = "thread_votes"
    __table_args__ = (db.UniqueConstraint("thread_id", "user_id", name="uq_tv"),)

    id        = db.Column(db.Integer, primary_key=True, autoincrement=True)
    thread_id = db.Column(db.Integer, db.ForeignKey("threads.id", ondelete="CASCADE"),
                          nullable=False, index=True)
    user_id   = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"),
                          nullable=False)
    value     = db.Column(db.SmallInteger, nullable=False)


class CommentVote(db.Model):
    __tablename__  = "comment_votes"
    __table_args__ = (db.UniqueConstraint("comment_id", "user_id", name="uq_cv"),)

    id         = db.Column(db.Integer, primary_key=True, autoincrement=True)
    comment_id = db.Column(db.Integer, db.ForeignKey("comments.id", ondelete="CASCADE"),
                           nullable=False, index=True)
    user_id    = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"),
                           nullable=False)
    value      = db.Column(db.SmallInteger, nullable=False)
