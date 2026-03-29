from urllib.parse import urlparse

TIER_1_DOMAINS = {
    "bloomberg.com",
    "reuters.com",
    "wsj.com",
    "ft.com",
}

TIER_2_DOMAINS = {
    "cnbc.com",
    "marketwatch.com",
    "barrons.com",
}

TIER_3_DOMAINS = {
    "finance.yahoo.com",
    "yahoo.com",
    "businessinsider.com",
    "forbes.com",
}

DOMAIN_TIER: dict[str, int] = {}
for d in TIER_1_DOMAINS:
    DOMAIN_TIER[d] = 1
for d in TIER_2_DOMAINS:
    DOMAIN_TIER[d] = 2
for d in TIER_3_DOMAINS:
    DOMAIN_TIER[d] = 3

TIER_CREDIBILITY = {
    1: 100,
    2: 80,
    3: 60,
}


def normalize_domain(url: str) -> str:
    host = urlparse(url).hostname or ""
    if host.startswith("www."):
        host = host[4:]
    return host.lower()


def get_tier(domain: str) -> int | None:
    """Return tier (1-3) if domain is whitelisted, else None."""
    clean = domain.lower()
    if clean.startswith("www."):
        clean = clean[4:]
    if clean in DOMAIN_TIER:
        return DOMAIN_TIER[clean]
    # Check if it's a subdomain of a whitelisted domain
    for allowed, tier in DOMAIN_TIER.items():
        if clean.endswith("." + allowed):
            return tier
    return None


def credibility_for_domain(domain: str) -> int | None:
    tier = get_tier(domain)
    if tier is None:
        return None
    return TIER_CREDIBILITY[tier]


def is_whitelisted(url: str) -> bool:
    domain = normalize_domain(url)
    return get_tier(domain) is not None


def score_url(url: str) -> tuple[str, int] | None:
    """Return (domain, credibility_score) if whitelisted, else None."""
    domain = normalize_domain(url)
    cred = credibility_for_domain(domain)
    if cred is None:
        return None
    return domain, cred
