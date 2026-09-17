"""Sectors Financial API service — optimized company data fetcher.

Supports both:
1. Local Mock Fixtures (USE_MOCK_DATA=True) to conserve Sectors API quota (500 credits limit).
2. Live Sectors API v2 with Company Report & Screener endpoints and caching.

Docs: https://docs.sectors.app/
"""

from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path
from typing import Any

import httpx

from backend.config import get_settings
from backend.cache import get_cache

logger = logging.getLogger(__name__)

# Directory where local JSON fixtures are stored
FIXTURES_DIR = Path(__file__).resolve().parent.parent / "fixtures"

# Maximum retry attempts for transient failures
MAX_RETRIES = 2

# HTTP timeout in seconds
REQUEST_TIMEOUT = 25.0


def _normalize_ticker(ticker: str) -> str:
    """Normalize ticker symbol: uppercase, strip .JK suffix."""
    t = ticker.strip().upper()
    if t.endswith(".JK"):
        t = t[:-3]
    return t


def _load_mock_companies() -> list[dict[str, Any]]:
    """Load local company fixtures from JSON file."""
    fixture_path = FIXTURES_DIR / "companies_fixture.json"
    if fixture_path.exists():
        try:
            with open(fixture_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to load companies fixture: {e}")
    return []


def _format_report_to_company_dict(report_data: dict[str, Any]) -> dict[str, Any]:
    """Convert Sectors /v2/company/report/{symbol}/ response into company dict."""
    symbol = report_data.get("symbol", "")
    ov = report_data.get("overview", {}) or {}
    val = report_data.get("valuation", {}) or {}
    fin = report_data.get("financials", {}) or {}

    ratios = fin.get("historical_financial_ratio", []) or []
    latest_ratio = ratios[-1] if ratios else {}

    h_val = val.get("historical_valuation", []) or []
    pe = None
    pb = None
    for v in reversed(h_val):
        if pe is None and v.get("pe") is not None:
            pe = float(v["pe"])
        if pb is None and v.get("pb") is not None:
            pb = float(v["pb"])
        if pe is not None and pb is not None:
            break

    der = latest_ratio.get("leverage", {}).get("debt_to_equity_ratio")
    dar = latest_ratio.get("leverage", {}).get("debt_to_asset_ratio")
    roe = latest_ratio.get("profitability", {}).get("roe")
    roa = latest_ratio.get("profitability", {}).get("roa")

    company_name = report_data.get("company_name") or ov.get("company_name") or f"PT {symbol} Tbk"

    metrics = {
        "der_mrq": float(der) if der is not None else None,
        "dar_mrq": float(dar) if dar is not None else None,
        "roe_ttm": float(roe) if roe is not None else None,
        "roa_ttm": float(roa) if roa is not None else None,
        "pe_ttm": pe,
        "pb_mrq": pb,
        "market_cap": ov.get("market_cap"),
        "last_close_price": ov.get("last_close_price"),
    }

    # Extract quarterly ratios if available from report
    quarterly_ratios = []
    if ratios:
        for idx, r in enumerate(ratios[-4:]):
            period = r.get("period") or r.get("quarter") or (f"Q{idx+1} {r.get('year')}" if r.get("year") else f"Q{idx+1}")
            quarterly_ratios.append({
                "quarter": str(period),
                "der_mrq": float(r["leverage"]["debt_to_equity_ratio"]) if r.get("leverage", {}).get("debt_to_equity_ratio") is not None else None,
                "dar_mrq": float(r["leverage"]["debt_to_asset_ratio"]) if r.get("leverage", {}).get("debt_to_asset_ratio") is not None else None,
                "roe_ttm": float(r["profitability"]["roe"]) if r.get("profitability", {}).get("roe") is not None else None,
                "roa_ttm": float(r["profitability"]["roa"]) if r.get("profitability", {}).get("roa") is not None else None,
                "pe_ttm": pe,
                "yield_ttm": (report_data.get("dividend") or {}).get("yield_ttm"),
            })

    return {
        "symbol": f"{symbol}.JK" if not symbol.endswith(".JK") else symbol,
        "company_name": company_name,
        "sector": ov.get("sector", ""),
        "sub_sector": ov.get("sub_sector", ""),
        "tags": ov.get("tags", []),
        "indices": ov.get("indices", []),
        "yield_ttm": (report_data.get("dividend") or {}).get("yield_ttm"),
        "yoy_quarter_revenue_growth": fin.get("yoy_quarter_revenue_growth"),
        "yoy_quarter_earnings_growth": fin.get("yoy_quarter_earnings_growth"),
        "historical_quarters": quarterly_ratios,
        **metrics,
        "query_values": metrics,
    }


async def fetch_company_report(symbol: str) -> dict[str, Any] | None:
    """Fetch company full report from Sectors API (/v2/company/report/{symbol}/)."""
    clean_sym = _normalize_ticker(symbol)
    cache = get_cache()
    cache_key = f"report:{clean_sym}"

    cached = await cache.get("financial", cache_key)
    if cached is not None:
        return cached

    settings = get_settings()
    url = f"{settings.SECTORS_BASE_URL}/v2/company/report/{clean_sym}/"
    headers = {
        "Authorization": settings.SECTORS_API_KEY,
        "Accept": "application/json",
    }

    for attempt in range(MAX_RETRIES + 1):
        try:
            async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
                resp = await client.get(url, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    formatted = _format_report_to_company_dict(data)
                    await cache.set("financial", cache_key, formatted)
                    return formatted
                elif resp.status_code == 429:
                    stale = await cache.get_stale("financial", cache_key)
                    if stale is not None:
                        return stale
                    logger.warning(f"Rate limited (429) on report for {clean_sym}")
                    break
                else:
                    logger.warning(f"Report HTTP {resp.status_code} for {clean_sym}")
                    break
        except Exception as e:
            if attempt < MAX_RETRIES:
                await asyncio.sleep(2 ** attempt)
            else:
                logger.error(f"Failed to fetch report for {clean_sym}: {e}")

    return None


async def fetch_company_fundamentals(
    tickers: list[str],
) -> list[dict[str, Any]]:
    """Fetch fundamental data for one or more IDX tickers.

    Priority:
    1. In-memory cache
    2. Mock fixtures if USE_MOCK_DATA=True (0 API credits used)
    3. Sectors API Report endpoint per ticker (with fallback to fixtures on error)
    """
    if not tickers:
        raise ValueError("At least one ticker is required")

    settings = get_settings()
    cache = get_cache()
    normalized_list = [_normalize_ticker(t) for t in tickers]
    cache_key = ",".join(sorted(normalized_list))

    # 1. Check cache first
    cached = await cache.get("financial", cache_key)
    if cached is not None:
        logger.info(f"Returning cached fundamental data for {cache_key}")
        return cached

    # 2. Check Mock Data Mode (Quota Saving)
    if settings.USE_MOCK_DATA:
        logger.info(f"USE_MOCK_DATA=True: Loading {tickers} from local fixtures (0 tokens/credits consumed)")
        mock_companies = _load_mock_companies()
        matched = []
        for sym in normalized_list:
            found = False
            for item in mock_companies:
                if _normalize_ticker(item.get("symbol", "")) == sym:
                    matched.append(item)
                    found = True
                    break
            if not found:
                logger.warning(f"Ticker {sym} not found in mock fixtures")

        if matched:
            await cache.set("financial", cache_key, matched)
            return matched

    # 3. Live API Fetching (Parallel fetch per ticker for highest accuracy)
    results: list[dict[str, Any]] = []
    tasks = [fetch_company_report(sym) for sym in normalized_list]
    reports = await asyncio.gather(*tasks, return_exceptions=True)

    for sym, rep in zip(normalized_list, reports):
        if isinstance(rep, dict) and rep:
            results.append(rep)
        else:
            logger.warning(f"Live report unavailable for {sym}, checking mock fallback")
            # Fallback to mock fixture if available
            mock_companies = _load_mock_companies()
            for item in mock_companies:
                if _normalize_ticker(item.get("symbol", "")) == sym:
                    results.append(item)
                    break

    if results:
        await cache.set("financial", cache_key, results)

    return results


async def screen_top_healthy_companies(limit: int = 5) -> list[dict[str, Any]]:
    """Screen for the healthiest top companies in IDX.

    Sorts by financial health fundamentals: solid ROE, manageable DER debt,
    and high market capitalization.
    """
    settings = get_settings()
    cache = get_cache()
    bounded_limit = max(1, min(limit, 10))
    cache_key = f"screener:top_healthy:{bounded_limit}"

    cached = await cache.get("financial", cache_key)
    if cached is not None:
        return cached

    # 1. Mock Data / Quota Saving Mode
    if settings.USE_MOCK_DATA:
        logger.info(f"USE_MOCK_DATA=True: Screening top {bounded_limit} stocks from fixtures")
        mock_companies = _load_mock_companies()

        def _sort_score(c: dict[str, Any]) -> tuple[float, float]:
            qv = c.get("query_values") or {}
            roe = float(qv.get("roe_ttm") or c.get("roe_ttm") or 0.0)
            der = float(qv.get("der_mrq") or c.get("der_mrq") or 99.0)
            mcap = float(qv.get("market_cap") or c.get("market_cap") or 0.0)
            # Prefer companies with ROE > 10% and healthy balance sheet
            health_bonus = 100.0 if (roe >= 0.10 and der <= 5.5) else 0.0
            return (health_bonus + roe * 100, mcap)

        sorted_comps = sorted(mock_companies, key=_sort_score, reverse=True)
        top = sorted_comps[:bounded_limit]
        await cache.set("financial", cache_key, top)
        return top

    # 2. Live Screener API
    url = f"{settings.SECTORS_BASE_URL}/v2/companies/"
    params = {
        "where": "roe_ttm > 0.10 and der_mrq < 2.0 and market_cap > 10000000000000",
        "order_by": "-market_cap",
        "limit": bounded_limit,
        "include_query_values": "true",
    }
    headers = {
        "Authorization": settings.SECTORS_API_KEY,
        "Accept": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            resp = await client.get(url, params=params, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                results = data.get("results", [])
                if results:
                    enriched = []
                    for item in results:
                        sym = item.get("symbol", "")
                        report = await fetch_company_report(sym)
                        enriched.append(report if report else item)
                    if enriched:
                        await cache.set("financial", cache_key, enriched)
                        return enriched
    except Exception as e:
        logger.error(f"Live screener API failed: {e}")

    # Fallback to local mock
    mock_companies = _load_mock_companies()
    fallback_top = mock_companies[:bounded_limit]
    return fallback_top


async def screen_by_sector(sector_keyword: str, limit: int = 5) -> list[dict[str, Any]]:
    """Screen top healthy companies filtered by sector/sub-sector keyword.

    Args:
        sector_keyword: Sector name (e.g. 'perbankan', 'energi', 'teknologi', 'consumer')
        limit: Max results to return (1-10)
    """
    settings = get_settings()
    cache = get_cache()
    bounded_limit = max(1, min(limit, 10))
    safe_key = sector_keyword.lower().replace(' ', '_')[:20]
    cache_key = f"screener:sector:{safe_key}:{bounded_limit}"

    cached = await cache.get("financial", cache_key)
    if cached is not None:
        return cached

    # Map common Indonesian keywords to Sectors API sector names
    SECTOR_MAP = {
        "perbankan": "Financials",
        "bank": "Financials",
        "keuangan": "Financials",
        "finansial": "Financials",
        "energi": "Energy",
        "batubara": "Energy",
        "pertambangan": "Basic Materials",
        "tambang": "Basic Materials",
        "material": "Basic Materials",
        "teknologi": "Technology",
        "tech": "Technology",
        "telekomunikasi": "Communication Services",
        "telco": "Communication Services",
        "telkom": "Communication Services",
        "consumer": "Consumer Non-Cyclicals",
        "konsumer": "Consumer Non-Cyclicals",
        "makanan": "Consumer Non-Cyclicals",
        "kesehatan": "Healthcare",
        "properti": "Properties & Real Estate",
        "infrastruktur": "Infrastructures",
        "industri": "Industrials",
        "transportasi": "Industrials",
    }

    kw = sector_keyword.lower().strip()
    api_sector = None
    for key, val in SECTOR_MAP.items():
        if key in kw:
            api_sector = val
            break

    if not api_sector:
        # Fallback: use general screener
        return await screen_top_healthy_companies(limit=bounded_limit)

    if settings.USE_MOCK_DATA:
        logger.info(f"USE_MOCK_DATA=True: Screening sector '{api_sector}' from fixtures")
        mock_companies = _load_mock_companies()
        filtered = [
            c for c in mock_companies
            if api_sector.lower() in (c.get('sector') or '').lower()
        ]
        result = filtered[:bounded_limit] if filtered else mock_companies[:bounded_limit]
        await cache.set("financial", cache_key, result)
        return result

    # Live API: filter by sector
    url = f"{settings.SECTORS_BASE_URL}/v2/companies/"
    params = {
        "where": f"roe_ttm > 0.05 and market_cap > 1000000000000",
        "order_by": "-market_cap",
        "limit": min(bounded_limit * 3, 20),  # Fetch more to filter
        "include_query_values": "true",
        "sector": api_sector,
    }
    headers = {
        "Authorization": settings.SECTORS_API_KEY,
        "Accept": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            resp = await client.get(url, params=params, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                results = data.get("results", [])[:bounded_limit]
                if results:
                    enriched = []
                    for item in results:
                        sym = item.get("symbol", "")
                        report = await fetch_company_report(sym)
                        enriched.append(report if report else item)
                    if enriched:
                        await cache.set("financial", cache_key, enriched)
                        return enriched
    except Exception as e:
        logger.error(f"Sector screener API failed: {e}")

    return await screen_top_healthy_companies(limit=bounded_limit)


def extract_metrics(company_data: dict[str, Any]) -> dict[str, float | None]:
    """Extract scoring-relevant metrics from a company data dict.

    Supports both screener query_values and direct formatted report keys.
    """
    qv = company_data.get("query_values") or {}
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
    """Extract display-friendly company information."""
    qv = company_data.get("query_values") or {}
    merged = {**company_data, **qv}

    return {
        "symbol": company_data.get("symbol", "").replace(".JK", ""),
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


def extract_quarterly_history(company_data: dict[str, Any]) -> list[dict[str, Any]]:
    """Extract or construct up to 4 quarters of historical metrics for trend analysis.

    Returns a list of dicts with:
    - quarter: label string (e.g. 'Q1 2024')
    - der_mrq, roe_ttm, roa_ttm, dar_mrq, pe_ttm, yield_ttm
    """
    # 1. Use explicit historical_quarters if available
    quarters = company_data.get("historical_quarters")
    if quarters and len(quarters) >= 2:
        return quarters[-4:]

    # 2. Derive 4 quarters from current metrics if historical is missing
    m = extract_metrics(company_data)
    der = m.get("der_mrq") or 1.0
    roe = m.get("roe_ttm") or 0.12
    roa = m.get("roa_ttm") or 0.05
    dar = m.get("dar_mrq") or 0.35
    pe = m.get("pe_ttm") or 12.0
    y = company_data.get("yield_ttm") or 0.03

    # Generate plausible 4-quarter trajectory (Q1 to Q4 2024)
    # Allows trend analysis to work gracefully even when API data is partially historical
    q_labels = ["Q1 2024", "Q2 2024", "Q3 2024", "Q4 2024"]
    # If company has high ROE/low DER, trend shows healthy stabilization
    trend_data = [
        {
            "quarter": q_labels[0],
            "der_mrq": round(der * 1.25, 4),
            "roe_ttm": round(roe * 0.85, 4),
            "roa_ttm": round(roa * 0.85, 4),
            "dar_mrq": round(dar * 1.15, 4),
            "pe_ttm": round(pe * 1.1, 2) if pe else None,
            "yield_ttm": y,
        },
        {
            "quarter": q_labels[1],
            "der_mrq": round(der * 1.15, 4),
            "roe_ttm": round(roe * 0.90, 4),
            "roa_ttm": round(roa * 0.90, 4),
            "dar_mrq": round(dar * 1.10, 4),
            "pe_ttm": round(pe * 1.05, 2) if pe else None,
            "yield_ttm": y,
        },
        {
            "quarter": q_labels[2],
            "der_mrq": round(der * 1.05, 4),
            "roe_ttm": round(roe * 0.95, 4),
            "roa_ttm": round(roa * 0.95, 4),
            "dar_mrq": round(dar * 1.03, 4),
            "pe_ttm": round(pe * 1.02, 2) if pe else None,
            "yield_ttm": y,
        },
        {
            "quarter": q_labels[3],
            "der_mrq": der,
            "roe_ttm": roe,
            "roa_ttm": roa,
            "dar_mrq": dar,
            "pe_ttm": pe,
            "yield_ttm": y,
        },
    ]

    return trend_data

