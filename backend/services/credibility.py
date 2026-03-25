"""
Credibility scoring for mentions from each source.
Scores are 0–100; mentions below the threshold are discarded.
"""

import math

# Subreddit quality tiers (score out of 20)
SUBREDDIT_SCORES = {
    "investing": 20,
    "stocks": 18,
    "stockmarket": 17,
    "valueinvesting": 18,
    "dividends": 16,
    "options": 15,
    "wallstreetbets": 15,
}

# News source credibility (score out of 100, used directly as credibility)
NEWS_SOURCE_SCORES = {
    # Tier 1
    "bloomberg": 100,
    "reuters": 100,
    "wsj": 100,
    "ft": 100,
    # Tier 2
    "cnbc": 80,
    "marketwatch": 80,
    "barrons": 80,
    "seekingalpha": 80,
    # Tier 3
    "yahoofinance": 60,
    "businessinsider": 60,
    "forbes": 60,
}

# Financial influencer accounts (Twitter handle → bonus points)
FINANCIAL_INFLUENCERS = {
    "jimcramer", "carlquintanilla", "unusual_whales", "deltaone",
    "marketwatch", "cnbc", "bloomberg", "reuters", "wsj",
}


def score_reddit(upvotes: int, account_age_days: int, karma: int, subreddit: str) -> float:
    """
    Returns a credibility score 0–100 for a Reddit mention.
    Minimum threshold to be included: 40.
    """
    # Upvotes: log scale, max 40 pts
    if upvotes <= 0:
        upvote_score = 0.0
    else:
        upvote_score = min(40.0, (math.log10(upvotes + 1) / math.log10(1001)) * 40)

    # Account age: 0–20 pts
    if account_age_days >= 730:      # 2+ years
        age_score = 20.0
    elif account_age_days >= 180:    # 6 months–2 years
        age_score = 10.0
    else:
        age_score = 0.0

    # Karma: 0–20 pts
    if karma >= 10_000:
        karma_score = 20.0
    elif karma >= 500:
        karma_score = 10.0
    else:
        karma_score = 0.0

    # Subreddit quality: 0–20 pts
    sub_lower = subreddit.lower().lstrip("r/")
    subreddit_score = float(SUBREDDIT_SCORES.get(sub_lower, 10))

    return upvote_score + age_score + karma_score + subreddit_score


def score_twitter(
    verified: bool,
    followers: int,
    likes: int,
    retweets: int,
    account_age_days: int,
    handle: str,
) -> float:
    """
    Returns a credibility score 0–100 for a Tweet.
    Minimum threshold to be included: 50.
    """
    # Verified badge: 0–30 pts
    verified_score = 30.0 if verified else 0.0

    # Followers: 0–30 pts
    if followers >= 100_000:
        follower_score = 30.0
    elif followers >= 10_000:
        follower_score = 20.0
    elif followers >= 1_000:
        follower_score = 10.0
    else:
        follower_score = 0.0

    # Engagement: 0–20 pts
    engagement = likes + retweets
    if engagement >= 1_000:
        engagement_score = 20.0
    elif engagement >= 100:
        engagement_score = 10.0
    else:
        engagement_score = 0.0

    # Account age: 0–10 pts
    age_score = 10.0 if account_age_days >= 1095 else 0.0   # 3+ years

    # Influencer bonus: 0–10 pts
    influencer_score = 10.0 if handle.lower().lstrip("@") in FINANCIAL_INFLUENCERS else 0.0

    return verified_score + follower_score + engagement_score + age_score + influencer_score


def score_news(source_domain: str) -> float:
    """Returns 0–100 for a news article based on its source domain."""
    key = source_domain.lower().replace("www.", "").replace(".com", "").replace(".co", "")
    return float(NEWS_SOURCE_SCORES.get(key, 0))
