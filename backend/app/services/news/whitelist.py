from urllib.parse import urlparse

# ── Source tiers ──────────────────────────────────────────────────────────────
# Tier 1 — premium financial press (credibility 100)
TIER_1_DOMAINS = {
    "bloomberg.com",
    "reuters.com",
    "wsj.com",
    "ft.com",
    "economist.com",
}

# Tier 2 — major financial media (credibility 80)
TIER_2_DOMAINS = {
    "cnbc.com",
    "marketwatch.com",
    "barrons.com",
    "thestreet.com",
    "investopedia.com",
    "morningstar.com",
    "benzinga.com",
}

# Tier 3 — broad financial/business media (credibility 60)
TIER_2_DOMAINS.add("investing.com")
TIER_2_DOMAINS.add("a.dj.com")   # WSJ/Dow Jones RSS subdomain

TIER_3_DOMAINS = {
    "finance.yahoo.com",
    "yahoo.com",
    "businessinsider.com",
    "forbes.com",
    "seekingalpha.com",
    "fool.com",          # Motley Fool
    "motleyfool.com",
    "zacks.com",
    "kiplinger.com",
    "moneycontrol.com",
    "nasdaq.com",
    "prnewswire.com",
    "globenewswire.com",
    "businesswire.com",
}

# Build lookup dict
DOMAIN_TIER: dict[str, int] = {}
for d in TIER_1_DOMAINS:
    DOMAIN_TIER[d] = 1
for d in TIER_2_DOMAINS:
    DOMAIN_TIER[d] = 2
for d in TIER_3_DOMAINS:
    DOMAIN_TIER[d] = 3

TIER_CREDIBILITY = {1: 100, 2: 80, 3: 60}


def normalize_domain(url: str) -> str:
    host = urlparse(url).hostname or ""
    if host.startswith("www."):
        host = host[4:]
    return host.lower()


def get_tier(domain: str) -> int | None:
    """Return tier (1–3) if domain is whitelisted, else None."""
    clean = domain.lower().removeprefix("www.")
    if clean in DOMAIN_TIER:
        return DOMAIN_TIER[clean]
    # Accept subdomains of whitelisted roots
    for allowed, tier in DOMAIN_TIER.items():
        if clean.endswith("." + allowed):
            return tier
    return None


def credibility_for_domain(domain: str) -> int | None:
    tier = get_tier(domain)
    return None if tier is None else TIER_CREDIBILITY[tier]


def is_whitelisted(url: str) -> bool:
    return get_tier(normalize_domain(url)) is not None


def score_url(url: str) -> tuple[str, int] | None:
    """Return (domain, credibility_score) if whitelisted, else None."""
    domain = normalize_domain(url)
    cred = credibility_for_domain(domain)
    if cred is None:
        return None
    return domain, cred


# ── Finnhub source-name → domain mapping ─────────────────────────────────────
FINNHUB_SOURCE_MAP: dict[str, str] = {
    "Bloomberg":                  "bloomberg.com",
    "Reuters":                    "reuters.com",
    "The Wall Street Journal":    "wsj.com",
    "WSJ":                        "wsj.com",
    "Financial Times":            "ft.com",
    "The Economist":              "economist.com",
    "CNBC":                       "cnbc.com",
    "MarketWatch":                "marketwatch.com",
    "Barron's":                   "barrons.com",
    "The Street":                 "thestreet.com",
    "TheStreet":                  "thestreet.com",
    "Investopedia":               "investopedia.com",
    "Morningstar":                "morningstar.com",
    "Benzinga":                   "benzinga.com",
    "Yahoo":                      "yahoo.com",
    "Yahoo Finance":              "finance.yahoo.com",
    "Business Insider":           "businessinsider.com",
    "Forbes":                     "forbes.com",
    "Seeking Alpha":              "seekingalpha.com",
    "The Motley Fool":            "fool.com",
    "Motley Fool":                "fool.com",
    "Zacks":                      "zacks.com",
    "Kiplinger":                  "kiplinger.com",
    "Nasdaq":                     "nasdaq.com",
    "PR Newswire":                "prnewswire.com",
    "GlobeNewswire":              "globenewswire.com",
    "Business Wire":              "businesswire.com",
}


def score_source(source_name: str) -> tuple[str, int] | None:
    """Return (domain, credibility_score) for a Finnhub source name, else None."""
    domain = FINNHUB_SOURCE_MAP.get(source_name)
    if not domain:
        return None
    cred = credibility_for_domain(domain)
    if cred is None:
        return None
    return domain, cred
