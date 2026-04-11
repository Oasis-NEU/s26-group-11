"""
AI-powered stock news summary using Anthropic Claude.
Gracefully disabled when ANTHROPIC_API_KEY is not set.
"""
from typing import Optional


def generate_stock_summary(ticker: str, articles: list[dict]) -> Optional[str]:
    """
    Generate a 2-3 sentence summary of recent news for a ticker.
    Returns None if API key not configured or on any error.

    articles: list of dicts with keys: title, summary, source_domain, sentiment_score
    """
    from app.core import config
    if not config.ANTHROPIC_API_KEY:
        return None
    if not articles:
        return None

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=config.ANTHROPIC_API_KEY)

        # Build article context (cap at 10 articles, truncate long summaries)
        article_lines = []
        for a in articles[:10]:
            title = a.get("title", "")
            summary = (a.get("summary") or "")[:200]
            source = a.get("source_domain", "")
            score = a.get("sentiment_score", 0) or 0
            sentiment = "bullish" if score > 0.05 else "bearish" if score < -0.05 else "neutral"
            article_lines.append(f"- [{sentiment}] {title} ({source})")
            if summary:
                article_lines.append(f"  {summary}")

        articles_text = "\n".join(article_lines)

        prompt = f"""You are a financial analyst assistant. Based on recent news articles about {ticker}, write a 2-3 sentence summary of what's happening with this stock right now. Be direct and factual. Mention the overall sentiment trend. Do not give investment advice or say "it's important to..." Just summarize the news.

Recent articles:
{articles_text}

Write the summary now (2-3 sentences, no preamble):"""

        message = client.messages.create(
            model="claude-haiku-4-5",
            max_tokens=200,
            messages=[{"role": "user", "content": prompt}],
        )
        return message.content[0].text.strip()

    except Exception as e:
        print(f"[ai_summary] Failed for {ticker}: {e}")
        return None
