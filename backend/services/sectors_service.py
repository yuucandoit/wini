"""Sectors Financial API service — optimized single-endpoint data fetcher.

Uses the Companies Screener (GET /v2/companies/) with structured `where`
and `order_by` parameters to fetch all fundamental data in a single call
at 1 API credit cost.

Docs: https://docs.sectors.app/api-references/v2/indonesia/screener/companies
"""

from __future__ import annotations

import httpx
import logging
from typing import Any

from backend.config import get_settings
from backend.cache import get_cache

logger = logging.getLogger(__name__)

# Metrics we always request via include_query_values
FUNDAMENTAL_FIELDS = [
    "der_mrq",
    "roe_ttm",
    "roa_ttm",
    "dar_mrq",
    "pe_ttm",
    "pb_mrq",
    "ps_ttm",
    "market_cap",
    "last_close_price",
    "company_name",
    "sector",
    "sub_sector",
    "indices",
    "tags",
    "yield_ttm",
    "total_assets_mrq",
    "total_equity_mrq",
    "total_revenue_mrq",
    "earnings_mrq",
    "total_liabilities_mrq",
    "yoy_quarter_revenue_growth",
    "yoy_quarter_earnings_growth",
]

# Maximum retry attempts for transient failures
MAX_RETRIES = 2

# HTTP timeout in seconds
REQUEST_TIMEOUT = 30.0


def _normalize_ticker(ticker: str) -> str:
    """Normalize ticker symbol: uppercase, strip .JK suffix."""
    t = ticker.strip().upper()
    if t.endswith(".JK"):
        t = t[:-3]
    return t


def _build_where_clause(tickers: list[str]) -> str:
    """Build a SQL-like WHERE clause for the screener.

    Example: symbol in ['TLKM','ISAT']
    """
    normalized = [_normalize_ticker(t) for t in tickers]
    symbols_str = ",".join(f"'{s}'" for s in normalized)
    return f"symbol in [{symbols_str}]"


async def fetch_company_fundamentals(
    tickers: list[str],
) -> list[dict[str, Any]]:
    """Fetch fundamental data for one or more IDX tickers.

    Uses the Companies Screener endpoint with structured parameters
    (1 API credit per call).

    Args:
        tickers: List of IDX ticker symbols (e.g. ["TLKM", "ISAT"]).

    Returns:
        List of company data dicts from the screener results.

    Raises:
        httpx.HTTPStatusError: On non-retryable HTTP errors.
        ValueError: If tickers list is empty.
    """
    if not tickers:
        raise ValueError("At least one ticker is required")

    cache = get_cache()
    cache_key = ",".join(sorted(_normalize_ticker(t) for t in tickers))

    # Check cache first
    cached = await cache.get("financial", cache_key)
    if cached is not None:
        logger.info(f"Returning cached data for {cache_key}")
        return cached

    settings = get_settings()
    where_clause = _build_where_clause(tickers)

    params = {
        "where": where_clause,
        "order_by": "symbol",
        "limit": 200,
        "include_query_values": "true",
    }

    headers = {
        "Authorization": settings.SECTORS_API_KEY,
        "Accept": "application/json",
    }

    url = f"{settings.SECTORS_BASE_URL}/v2/companies/"

    last_error: Exception | None = None

    for attempt in range(MAX_RETRIES + 1):
        try:
            async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
                response = await client.get(url, params=params, headers=headers)

                if response.status_code == 429:
                    # Rate limited — try stale cache
                    logger.warning("Sectors API rate limit hit (429)")
                    stale = await cache.get_stale("financial", cache_key)
                    if stale is not None:
                        return stale
                    raise httpx.HTTPStatusError(
                        "Rate limit exceeded",
                        request=response.request,
                        response=response,
                    )

                response.raise_for_status()
                data = response.json()

            results = data.get("results", [])
            logger.info(
                f"Fetched {len(results)} companies for tickers: "
                f"{[_normalize_ticker(t) for t in tickers]}"
            )

            # Cache the results
            await cache.set("financial", cache_key, results)
            return results

        except httpx.HTTPStatusError as e:
            last_error = e
            status = e.response.status_code

            if status == 400:
                # Bad request — don't retry, raise immediately
                error_body = e.response.text
                logger.error(f"Sectors API bad request: {error_body}")
                raise ValueError(
                    f"Invalid query to Sectors API: {error_body}"
                ) from e

            if status in (401, 403):
                logger.error("Sectors API authentication failed")
                raise

            # For 5xx and other errors, retry
            if attempt < MAX_RETRIES:
                wait = 2 ** attempt
                logger.warning(
                    f"Sectors API error {status}, retrying in {wait}s "
                    f"(attempt {attempt + 1}/{MAX_RETRIES})"
                )
                import asyncio
                await asyncio.sleep(wait)
            else:
                # All retries exhausted — try stale cache
                stale = await cache.get_stale("financial", cache_key)
                if stale is not None:
                    logger.warning("Using stale cache after retries exhausted")
                    return stale
                raise

        except httpx.TimeoutException:
            last_error = httpx.TimeoutException("Request timed out")
            if attempt < MAX_RETRIES:
                wait = 2 ** attempt
                logger.warning(
                    f"Sectors API timeout, retrying in {wait}s "
                    f"(attempt {attempt + 1}/{MAX_RETRIES})"
                )
                import asyncio
                await asyncio.sleep(wait)
            else:
                stale = await cache.get_stale("financial", cache_key)
                if stale is not None:
                    logger.warning("Using stale cache after timeout retries")
                    return stale
                raise

    # Should not reach here, but just in case
    if last_error:
        raise last_error
    return []


def extract_metrics(company_data: dict[str, Any]) -> dict[str, float | None]:
    """Extract scoring-relevant metrics from a company data dict.

    The screener returns metrics in `query_values` when
    `include_query_values=true` is set, or as top-level fields.

    Args:
        company_data: A single company result from the screener.

    Returns:
        Dict with metric names as keys and float values (or None).
    """
    # query_values contains the field values we requested
    qv = company_data.get("query_values") or {}

    # Merge top-level and query_values, preferring query_values
    merged = {**company_data, **qv}

    metrics = {}
    for field in ["der_mrq", "roe_ttm", "roa_ttm", "dar_mrq", "pe_ttm"]:
        val = merged.get(field)
        if val is not None:
            try:
                metrics[field] = float(val)
            except (ValueError, TypeError):
                metrics[field] = None
        else:
            metrics[field] = None

    return metrics


def extract_company_info(company_data: dict[str, Any]) -> dict[str, Any]:
    """Extract display-friendly company information.

    Args:
        company_data: A single company result from the screener.

    Returns:
        Dict with company metadata for display/narrative.
    """
    qv = company_data.get("query_values") or {}
    merged = {**company_data, **qv}

    return {
        "symbol": company_data.get("symbol", ""),
        "company_name": company_data.get("company_name", ""),
        "sector": merged.get("sector", ""),
        "sub_sector": merged.get("sub_sector", ""),
        "market_cap": merged.get("market_cap"),
        "last_close_price": merged.get("last_close_price"),
        "indices": merged.get("indices", []),
        "tags": merged.get("tags", []),
        "pe_ttm": merged.get("pe_ttm"),
        "pb_mrq": merged.get("pb_mrq"),
        "yield_ttm": merged.get("yield_ttm"),
        "yoy_quarter_revenue_growth": merged.get("yoy_quarter_revenue_growth"),
        "yoy_quarter_earnings_growth": merged.get("yoy_quarter_earnings_growth"),
    }
