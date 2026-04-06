from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


@dataclass
class NewsMentionDTO:
    ticker:           str
    title:            str
    url:              str
    source_domain:    str
    published_at:     datetime
    credibility_score: int
    raw_provider:     str
    summary:          Optional[str]   = None
    sentiment_score:  Optional[float] = None
    event_type:       Optional[str]   = None
    event_confidence: Optional[float] = None
    subreddit:        Optional[str]   = None
    source_type:      str             = "news"   # "news" | "reddit"
    upvotes:          int             = 0
