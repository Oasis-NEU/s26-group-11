"""
Collects and filters Reddit mentions of stock tickers.
Uses PRAW (Python Reddit API Wrapper).
"""

import re
import os
from datetime import datetime, timezone, timedelta

import praw

from .credibility import score_reddit, SUBREDDIT_SCORES

# Disable Reddit collection if credentials are not set
REDDIT_ENABLED = bool(
    os.environ.get("REDDIT_CLIENT_ID") and os.environ.get("REDDIT_CLIENT_SECRET")
)

# Subreddits to monitor
TRACKED_SUBREDDITS = list(SUBREDDIT_SCORES.keys())

# Minimum upvotes per subreddit (WSB is noisier)
MIN_UPVOTES = {"wallstreetbets": 200}
DEFAULT_MIN_UPVOTES = 50

# Regex to extract ticker mentions: $AAPL, plain AAPL (2-5 uppercase letters)
_TICKER_RE = re.compile(r"\$([A-Z]{1,5})\b|(?<!\w)([A-Z]{2,5})(?!\w)")

# Common false positives to exclude
_BLACKLIST = {
    "I", "A", "THE", "FOR", "AND", "OR", "BUT", "CEO", "IPO", "SEC",
    "USD", "GDP", "YOY", "QOQ", "AI", "API", "ETF", "PE", "EPS",
    "DD", "YOLO", "WSB", "IMO", "OTC", "AH", "PM", "EOD",
}


def _get_client():
    return praw.Reddit(
        client_id=os.environ.get("REDDIT_CLIENT_ID", ""),
        client_secret=os.environ.get("REDDIT_CLIENT_SECRET", ""),
        user_agent=os.environ.get("REDDIT_USER_AGENT", "SentimentSignal/1.0"),
    )


def extract_tickers(text: str) -> list[str]:
    """Return unique tickers mentioned in text."""
    matches = _TICKER_RE.findall(text)
    tickers = set()
    for dollar_match, plain_match in matches:
        ticker = dollar_match or plain_match
        if ticker and ticker not in _BLACKLIST and len(ticker) >= 2:
            tickers.add(ticker)
    return list(tickers)


def _account_age_days(redditor) -> int:
    try:
        created = redditor.created_utc
        age = datetime.now(timezone.utc) - datetime.fromtimestamp(created, tz=timezone.utc)
        return age.days
    except Exception:
        return 0


def _karma(redditor) -> int:
    try:
        return redditor.link_karma + redditor.comment_karma
    except Exception:
        return 0


def collect_for_ticker(ticker: str, hours_back: int = 24) -> list[dict]:
    """
    Scrape all tracked subreddits for posts/comments mentioning `ticker`.
    Returns a list of raw mention dicts (not yet stored to DB).
    """
    if not REDDIT_ENABLED:
        print("[reddit_collector] Skipping — REDDIT_CLIENT_ID/SECRET not set")
        return []

    try:
        reddit = _get_client()
    except Exception as e:
        print(f"[reddit_collector] Failed to initialize PRAW client: {e}")
        return []
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours_back)
    results = []

    for sub_name in TRACKED_SUBREDDITS:
        min_ups = MIN_UPVOTES.get(sub_name, DEFAULT_MIN_UPVOTES)
        subreddit = reddit.subreddit(sub_name)

        try:
            posts = list(subreddit.search(
                f"${ticker} OR {ticker}",
                sort="new",
                time_filter="day",
                limit=50,
            ))
        except Exception:
            continue

        for post in posts:
            post_time = datetime.fromtimestamp(post.created_utc, tz=timezone.utc)
            if post_time < cutoff:
                continue
            if post.score < min_ups:
                continue

            tickers_found = extract_tickers(f"{post.title} {post.selftext}")
            if ticker not in tickers_found:
                continue

            try:
                age = _account_age_days(post.author)
                karma = _karma(post.author)
            except Exception:
                age, karma = 0, 0

            credibility = score_reddit(
                upvotes=post.score,
                account_age_days=age,
                karma=karma,
                subreddit=sub_name,
            )

            if credibility < 40:
                continue

            text = f"{post.title}\n{post.selftext}".strip()
            results.append({
                "source": "reddit",
                "external_id": post.id,
                "text": text[:2000],
                "url": f"https://reddit.com{post.permalink}",
                "author": str(post.author),
                "author_account_age_days": age,
                "author_karma": karma,
                "author_verified": False,
                "upvotes": post.score,
                "comments": post.num_comments,
                "subreddit": sub_name,
                "credibility_score": credibility,
                "published_at": post_time,
            })

    return results
