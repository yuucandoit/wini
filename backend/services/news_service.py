"""News service — fetches IDX news articles from Sectors API.

Uses GET /v2/news/ with symbol filtering and the built-in sentiment
tags from Sectors (Bullish, Bearish, etc.) for sentiment analysis.

Docs: https://docs.sectors.app/api-references/v2/indonesia/news/news
"""

from __future__ import annotations

import httpx
import logging
from typing import Any

from backend.config import get_settings
from backend.cache import get_cache

logger = logging.getLogger(__name__)

# HTTP timeout in seconds
REQUEST_TIMEOUT = 20.0

# Maximum retry attempts
MAX_RETRIES = 2

# Default number of news articles to fetch
DEFAULT_NEWS_LIMIT = 5

# Sentiment tag classification
BULLISH_TAGS = {"Bullish", "Growth", "Expansion", "Outperformance"}
BEARISH_TAGS = {"Bearish", "Risk & Compliance", "Violation", "Underperformance"}
NEUTRAL_TAGS = {"Neutral", "Ownership", "Dividend", "Technical"}


def classify_sentiment(tags: list[str]) -> str:
    """Classify overall sentiment from news tags.

    Args:
        tags: List of tag strings from the news article.

    Returns:
        One of: 'POSITIF', 'NEGATIF', 'NETRAL'
    """
    if not tags:
        return "NETRAL"

    tag_set = set(tags)
    bullish_count = len(tag_set & BULLISH_TAGS)
    bearish_count = len(tag_set & BEARISH_TAGS)

    if bullish_count > bearish_count:
        return "POSITIF"
    elif bearish_count > bullish_count:
        return "NEGATIF"
    return "NETRAL"


async def fetch_news(
    symbols: list[str] | None = None,
    limit: int = DEFAULT_NEWS_LIMIT,
    sub_sector: str | None = None,
) -> list[dict[str, Any]]:
    """Fetch recent IDX news articles from Sectors API.

    Args:
        symbols: Optional list of IDX ticker symbols to filter by.
        limit: Maximum number of articles to return (max 30 per API).
        sub_sector: Optional subsector slug to filter by.

    Returns:
        List of news article dicts with added 'sentiment' field.
    """
    cache = get_cache()
    cache_key_parts = []
    if symbols:
        cache_key_parts.append("sym=" + ",".join(sorted(s.upper() for s in symbols)))
    if sub_sector:
        cache_key_parts.append(f"sub={sub_sector}")
    cache_key_parts.append(f"n={limit}")
    cache_key = "|".join(cache_key_parts) if cache_key_parts else "latest"

    # Check cache first
    cached = await cache.get("news", cache_key)
    if cached is not None:
        logger.info(f"Returning cached news for {cache_key}")
        return cached

    settings = get_settings()

    params: dict[str, Any] = {
        "extension": "idx",
        "limit": min(limit, 30),  # API max is 30
    }

    if symbols:
        params["symbols"] = ",".join(s.strip().upper() for s in symbols)

    if sub_sector:
        params["sub_sector"] = sub_sector

    headers = {
        "Authorization": settings.SECTORS_API_KEY,
        "Accept": "application/json",
    }

    url = f"{settings.SECTORS_BASE_URL}/v2/news/"

    for attempt in range(MAX_RETRIES + 1):
        try:
            async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
                response = await client.get(url, params=params, headers=headers)

                if response.status_code == 429:
                    logger.warning("Sectors News API rate limit hit (429)")
                    stale = await cache.get_stale("news", cache_key)
                    if stale is not None:
                        return stale
                    raise httpx.HTTPStatusError(
                        "Rate limit exceeded",
                        request=response.request,
                        response=response,
                    )

                response.raise_for_status()
                data = response.json()

            articles = data.get("results", [])

            # Enrich each article with sentiment classification
            enriched = []
            for article in articles:
                article_tags = article.get("tags", [])
                enriched.append({
                    "title": article.get("title", ""),
                    "body": article.get("body", ""),
                    "tags": article_tags,
                    "sentiment": classify_sentiment(article_tags),
                    "timestamp": article.get("timestamp", ""),
                    "sector": article.get("sector", ""),
                    "sub_sector": article.get("sub_sector", []),
                    "symbols": article.get("symbols", []),
                    "source": article.get("source", ""),
                })

            logger.info(f"Fetched {len(enriched)} news articles")

            # Cache the enriched results
            await cache.set("news", cache_key, enriched)
            return enriched

        except httpx.HTTPStatusError as e:
            status = e.response.status_code

            if status in (400, 401, 403):
                logger.error(f"Sectors News API error {status}: {e.response.text}")
                raise

            if attempt < MAX_RETRIES:
                wait = 2 ** attempt
                logger.warning(
                    f"Sectors News API error {status}, retrying in {wait}s "
                    f"(attempt {attempt + 1}/{MAX_RETRIES})"
                )
                import asyncio
                await asyncio.sleep(wait)
            else:
                stale = await cache.get_stale("news", cache_key)
                if stale is not None:
                    logger.warning("Using stale news cache after retries exhausted")
                    return stale
                raise

        except httpx.TimeoutException:
            if attempt < MAX_RETRIES:
                wait = 2 ** attempt
                logger.warning(
                    f"Sectors News API timeout, retrying in {wait}s "
                    f"(attempt {attempt + 1}/{MAX_RETRIES})"
                )
                import asyncio
                await asyncio.sleep(wait)
            else:
                stale = await cache.get_stale("news", cache_key)
                if stale is not None:
                    logger.warning("Using stale news cache after timeout retries")
                    return stale
                raise

    return []


def summarize_news_sentiment(articles: list[dict]) -> dict[str, Any]:
    """Summarize sentiment across a list of news articles.

    Args:
        articles: List of enriched news articles.

    Returns:
        Summary dict with counts and overall sentiment.
    """
    if not articles:
        return {
            "total_articles": 0,
            "sentiment_breakdown": {},
            "overall_sentiment": "NETRAL",
            "key_headlines": [],
        }

    sentiments = {"POSITIF": 0, "NEGATIF": 0, "NETRAL": 0}
    for article in articles:
        s = article.get("sentiment", "NETRAL")
        sentiments[s] = sentiments.get(s, 0) + 1

    # Determine overall sentiment
    if sentiments["POSITIF"] > sentiments["NEGATIF"]:
        overall = "POSITIF"
    elif sentiments["NEGATIF"] > sentiments["POSITIF"]:
        overall = "NEGATIF"
    else:
        overall = "NETRAL"

    # Extract key headlines (up to 3)
    key_headlines = [
        {
            "title": a.get("title", ""),
            "sentiment": a.get("sentiment", "NETRAL"),
        }
        for a in articles[:3]
    ]

    return {
        "total_articles": len(articles),
        "sentiment_breakdown": sentiments,
        "overall_sentiment": overall,
        "key_headlines": key_headlines,
    }
