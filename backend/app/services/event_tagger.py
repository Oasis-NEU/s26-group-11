"""
Rule-based event tagger for financial news headlines.

Detects structured event types using compiled regex patterns:
  earnings_beat, earnings_miss, guidance_up, guidance_down,
  fda_approval, fda_rejection, acquisition, ceo_change,
  layoffs, partnership, buyback, ipo

Returns (event_type, confidence) or (None, None) if no event detected.
Confidence: 1.0 = multiple patterns matched, 0.8 = strong single match,
            0.6 = short single match.
"""
from __future__ import annotations

import re
from typing import Optional

_PATTERNS: list[tuple[str, list[str]]] = [
    ("earnings_beat", [
        r"beat[s]?\s+(earnings|estimates|expectations|consensus)",
        r"surpass(ed|es)?\s+(analyst|consensus|estimates)",
        r"above\s+(analyst\s+)?estimates",
        r"profit\s+beat",
        r"topped?\s+(earnings|estimates)",
    ]),
    ("earnings_miss", [
        r"miss(ed|es|ing)?\s+(earnings|estimates|expectations|consensus)",
        r"fell?\s+short\s+of\s+(analyst\s+)?(estimates|expectations)",
        r"below\s+(analyst\s+)?estimates",
        r"profit\s+miss",
    ]),
    ("guidance_up", [
        r"rais(ed|es|ing)\s+(full.year\s+)?(guidance|outlook|forecast)",
        r"increas(ed|es|ing)\s+(annual\s+)?guidance",
        r"upward(ly)?\s+revis(ed|es)",
        r"lifted\s+(guidance|outlook)",
    ]),
    ("guidance_down", [
        r"lower(ed|s|ing)\s+(full.year\s+)?(guidance|outlook|forecast)",
        r"cut[s]?\s+(guidance|outlook|forecast)",
        r"downward(ly)?\s+revis(ed|es)",
        r"slash(ed|es|ing)\s+(guidance|outlook)",
    ]),
    ("fda_approval", [
        r"fda\s+(approv(ed|es|al)|clear(ed|s|ance))",
        r"approv(ed|al)\s+by\s+(the\s+)?fda",
        r"receives?\s+fda\s+approv",
        r"\bnda\s+approv|\bbla\s+approv",
    ]),
    ("fda_rejection", [
        r"fda\s+(reject(ed|s|ion)|refus(ed|es)|issue[sd]?\s+complete\s+response)",
        r"reject(ed|ion)\s+by\s+(the\s+)?fda",
        r"complete\s+response\s+letter",
        r"fda\s+denies?",
    ]),
    ("acquisition", [
        r"acqui(re[sd]?|ring|sition)",
        r"takeover\s+(bid|offer|deal)",
        r"merger\s+(agreement|deal|talks|closes?)",
        r"to\s+(acquire|buy)\s+\w[\w\s]*\s+for\s+\$",
        r"buyout\s+(deal|offer|agreement)",
    ]),
    ("ceo_change", [
        r"ceo\s+(resign(s|ed)?|step(s|ped)?\s+down|appoint(ed|s)|named|replac(ed|es))",
        r"(names?|appoints?|hires?)\s+new\s+(chief\s+executive|ceo)",
        r"chief\s+executive\s+(resign|step|depart|exit|leav)",
        r"(founder|president)\s+.{0,20}\s+(resign|step\s+down|leaves?)",
    ]),
    ("layoffs", [
        r"lay(off[s]?|ing\s+off)\s+\d",
        r"\d[\d,]*\s+job\s+cut[s]?",
        r"workforce\s+reduc(tion|ing)",
        r"cut[s]?\s+\d[\d,]*\s+jobs",
        r"redund(ancies|ancy)\s+of\s+\d",
    ]),
    ("partnership", [
        r"partner(ship)?\s+(agreement\s+)?with\s+\w",
        r"strategic\s+(alliance|partner)",
        r"joint\s+venture\s+(with|agreement)",
        r"collaboration\s+(agreement|deal)\s+with",
    ]),
    ("buyback", [
        r"share\s+(buyback|repurchase)\s+program",
        r"stock\s+repurchase\s+(program|plan)",
        r"(authorize[sd]?|announce[sd]?)\s+\$[\d\.]+\s*(billion|million)?\s*(share\s+)?buyback",
        r"repurchas(e[sd]?|ing)\s+(up\s+to\s+)?\$",
    ]),
    ("ipo", [
        r"\bipo\b",
        r"initial\s+public\s+offer(ing)?",
        r"going\s+public\s+(on|via|through)",
        r"debut[s]?\s+on\s+(nasdaq|nyse|the\s+(stock\s+)?market)",
        r"prices?\s+(its\s+)?ipo\s+at",
    ]),
]

_COMPILED: list[tuple[str, list[re.Pattern]]] = [
    (event, [re.compile(p, re.IGNORECASE) for p in pats])
    for event, pats in _PATTERNS
]


def tag_event(
    title: str,
    summary: Optional[str] = None,
) -> tuple[Optional[str], Optional[float]]:
    """
    Detect a structured event type from headline + optional summary.

    Returns (event_type, confidence) or (None, None) if no event detected.
    Events are checked in priority order — first match wins.
    """
    text = f"{title} {summary or ''}"

    for event_type, compiled_pats in _COMPILED:
        matches = [p for p in compiled_pats if p.search(text)]
        if not matches:
            continue
        if len(matches) >= 2:
            return (event_type, 1.0)
        # Single match: confidence based on pattern specificity
        pat_len = len(matches[0].pattern)
        confidence = 0.8 if pat_len > 25 else 0.6
        return (event_type, confidence)

    return (None, None)
