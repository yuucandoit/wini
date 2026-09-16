"""Token optimizer for compressing data payloads before LLM synthesis.

Reduces token consumption by:
- Stripping null/None values
- Truncating long text fields (news bodies)
- Removing API wrapper metadata (pagination, etc.)
- Condensing field names for context efficiency
"""

from __future__ import annotations

import json
import logging
from typing import Any

logger = logging.getLogger(__name__)

# Maximum characters for news body text
MAX_NEWS_BODY_LENGTH = 200

# Maximum total characters for the optimized prompt
MAX_PROMPT_CHARS = 12000  # ~3000 tokens

# Fields to strip from API responses
STRIP_FIELDS = {
    "pagination", "llm_translation", "query_values",
    "thumbnail", "source", "dimension",
}


def strip_nulls(data: Any) -> Any:
    """Recursively remove None values and empty collections from data."""
    if isinstance(data, dict):
        return {
            k: strip_nulls(v)
            for k, v in data.items()
            if v is not None and v != [] and v != {} and k not in STRIP_FIELDS
        }
    elif isinstance(data, list):
        return [strip_nulls(item) for item in data if item is not None]
    return data


def truncate_text(text: str, max_length: int = MAX_NEWS_BODY_LENGTH) -> str:
    """Truncate text to max_length, adding ellipsis if truncated."""
    if not text or len(text) <= max_length:
        return text
    return text[:max_length].rsplit(" ", 1)[0] + "..."


def optimize_news(news_items: list[dict]) -> list[dict]:
    """Optimize news data for LLM consumption."""
    optimized = []
    for item in news_items:
        optimized.append({
            "title": item.get("title", ""),
            "body": truncate_text(item.get("body", "")),
            "tags": item.get("tags", []),
            "timestamp": item.get("timestamp", ""),
            "sector": item.get("sector", ""),
        })
    return optimized


def optimize_company_data(companies: list[dict]) -> list[dict]:
    """Optimize company screener data for LLM consumption."""
    optimized = []
    for company in companies:
        clean = strip_nulls(company)
        optimized.append(clean)
    return optimized


def optimize_for_llm(
    company_data: list[dict] | None = None,
    news_data: list[dict] | None = None,
    scores: dict | None = None,
) -> str:
    """Build an optimized context string for LLM synthesis.
    
    Args:
        company_data: Raw company data from Sectors API
        news_data: Raw news articles from Sectors API  
        scores: Health score results per ticker
    
    Returns:
        Compressed JSON string ready for LLM prompt
    """
    context = {}
    
    if company_data:
        context["companies"] = optimize_company_data(company_data)
    
    if news_data:
        context["news"] = optimize_news(news_data)
    
    if scores:
        context["health_scores"] = scores
    
    result = json.dumps(context, ensure_ascii=False, separators=(",", ":"))
    
    # Truncate if exceeds max prompt size
    if len(result) > MAX_PROMPT_CHARS:
        logger.warning(
            f"Prompt size {len(result)} exceeds max {MAX_PROMPT_CHARS}, truncating"
        )
        result = result[:MAX_PROMPT_CHARS]
    
    return result
