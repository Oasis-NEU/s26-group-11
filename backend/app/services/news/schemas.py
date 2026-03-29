from dataclasses import dataclass
from datetime import datetime


@dataclass
class NewsMentionDTO:
    ticker: str
    title: str
    url: str
    source_domain: str
    published_at: datetime
    credibility_score: int
    raw_provider: str
    summary: str | None = None
