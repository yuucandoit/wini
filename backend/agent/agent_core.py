"""Agent core — the central orchestrator for WINI AI analysis.

Coordinates the full analysis pipeline:
1. Parse user intent
2. Parallel data fetching (company fundamentals + news)
3. Deterministic scoring
4. Token-optimized LLM narrative synthesis
5. Response assembly with disclaimer
"""

from __future__ import annotations

import asyncio
import json
import httpx
import logging
import uuid
from typing import Any

from backend.config import get_settings
from backend.services.sectors_service import (
    fetch_company_fundamentals,
    extract_metrics,
    extract_company_info,
)
from backend.services.news_service import (
    fetch_news,
    summarize_news_sentiment,
)
from backend.scoring import calculate_health_score, calculate_comparative_score
from backend.optimizer import optimize_for_llm
from backend.disclaimers import get_disclaimer
from backend.agent.memory import get_memory

logger = logging.getLogger(__name__)

# LLM system prompt for narrative synthesis
SYSTEM_PROMPT = (
    "Kamu adalah WINI AI, analis investasi cerdas berbahasa Indonesia. "
    "Tugasmu adalah membuat narasi analisis komparatif berdasarkan data "
    "kuantitatif yang diberikan. "
    "\n\nATURAN KETAT:"
    "\n1. JANGAN mengarang atau menambahkan angka yang tidak ada di data."
    "\n2. Gunakan HANYA data yang disediakan dalam konteks."
    "\n3. Jelaskan dalam bahasa yang mudah dipahami investor pemula."
    "\n4. Sertakan perbandingan antar emiten jika ada lebih dari satu."
    "\n5. Sebutkan status kesehatan keuangan (SEHAT/WASPADA/BERISIKO TINGGI)."
    "\n6. Format: 2-3 paragraf singkat dan padat."
    "\n7. Jika ada berita terkait, sebutkan sentimen umumnya."
    "\n8. Gunakan bahasa narasi yang mengalir dan ramah Text-to-Speech (hindari simbol aneh atau karakter berlebihan)."
)

# HTTP timeout for LLM calls
LLM_TIMEOUT = 60.0


async def _call_llm(
    user_message: str,
    context_data: str,
    session_history: list[dict[str, str]] | None = None,
) -> str:
    """Call OpenRouter LLM for narrative synthesis.

    Args:
        user_message: The user's original query.
        context_data: Optimized JSON context string.
        session_history: Previous conversation turns for continuity.

    Returns:
        LLM-generated narrative string.
    """
    settings = get_settings()

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
    ]

    # Add conversation history for context
    if session_history:
        messages.extend(session_history[-4:])  # Last 4 turns max

    # Build the user message with data context
    full_user_message = (
        f"Pertanyaan pengguna: {user_message}\n\n"
        f"Data analisis (JSON):\n{context_data}"
    )
    messages.append({"role": "user", "content": full_user_message})

    payload = {
        "model": settings.OPENROUTER_MODEL,
        "messages": messages,
        "max_tokens": 1024,
        "temperature": 0.3,  # Low temperature for factual consistency
    }

    headers = {
        "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://wini-ai.app",
        "X-Title": "WINI AI Investment Analyst",
    }

    url = f"{settings.OPENROUTER_BASE_URL}/chat/completions"

    try:
        async with httpx.AsyncClient(timeout=LLM_TIMEOUT) as client:
            response = await client.post(url, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()

        choices = data.get("choices", [])
        if choices:
            raw_content = choices[0].get("message", {}).get("content", "")
            # Clean thinking tags from reasoning models
            import re
            cleaned_content = re.sub(r"<think>.*?</think>", "", raw_content, flags=re.DOTALL)
            cleaned_content = re.sub(r"^Here's a thinking process:.*?\n\n", "", cleaned_content, flags=re.DOTALL | re.IGNORECASE)
            return cleaned_content.strip()

        logger.warning("LLM returned no choices")
        return _fallback_narrative()

    except httpx.HTTPStatusError as e:
        logger.error(f"LLM API error {e.response.status_code}: {e.response.text}")
        return _fallback_narrative()

    except httpx.TimeoutException:
        logger.error("LLM API request timed out")
        return _fallback_narrative()

    except Exception as e:
        logger.error(f"Unexpected LLM error: {e}")
        return _fallback_narrative()


def _fallback_narrative() -> str:
    """Generate a fallback narrative when LLM is unavailable."""
    return (
        "Maaf, layanan analisis naratif sedang tidak tersedia. "
        "Silakan lihat skor kesehatan keuangan dan metrik di atas "
        "untuk referensi analisis Anda. Skor dihitung berdasarkan "
        "rasio DER, ROE, ROA, DAR, dan PE secara deterministik."
    )


async def analyze(
    tickers: list[str],
    user_query: str,
    session_id: str | None = None,
) -> dict[str, Any]:
    """Run the full WINI AI analysis pipeline.

    Args:
        tickers: List of IDX ticker symbols to analyze.
        user_query: The user's natural language query.
        session_id: Optional session ID for conversation continuity.

    Returns:
        Complete analysis response dict.
    """
    # Ensure session
    if not session_id:
        session_id = str(uuid.uuid4())

    memory = get_memory()
    session_history = memory.get_history(session_id)

    # Record user turn
    memory.add_turn(session_id, "user", user_query)

    # Normalize tickers
    normalized_tickers = [t.strip().upper().replace(".JK", "") for t in tickers]

    # --- Phase 1: Parallel data fetching ---
    logger.info(f"Starting analysis for tickers: {normalized_tickers}")

    company_task = fetch_company_fundamentals(normalized_tickers)
    news_task = fetch_news(symbols=normalized_tickers, limit=5)

    try:
        company_data, news_data = await asyncio.gather(
            company_task,
            news_task,
            return_exceptions=True,
        )
    except Exception as e:
        logger.error(f"Critical error in data fetching: {e}")
        raise

    # Handle partial failures gracefully
    if isinstance(company_data, Exception):
        logger.error(f"Company data fetch failed: {company_data}")
        company_data = []

    if isinstance(news_data, Exception):
        logger.warning(f"News data fetch failed: {news_data}")
        news_data = []

    # --- Phase 2: Deterministic scoring ---
    health_scores: dict[str, dict[str, Any]] = {}
    company_infos: dict[str, dict[str, Any]] = {}

    for company in company_data:
        symbol = company.get("symbol", "").replace(".JK", "")
        if not symbol:
            continue

        metrics = extract_metrics(company)
        score_result = calculate_health_score(metrics)

        health_scores[symbol] = {
            "score": score_result.score,
            "status": score_result.status,
            "metrics_evaluated": score_result.metrics_evaluated,
            "metrics_coverage": score_result.metrics_coverage,
            "breakdown": score_result.breakdown,
        }

        company_infos[symbol] = extract_company_info(company)

    # Handle tickers not found in API response
    for ticker in normalized_tickers:
        if ticker not in health_scores:
            logger.warning(f"No data found for ticker: {ticker}")
            health_scores[ticker] = {
                "score": 0,
                "status": "DATA TIDAK TERSEDIA",
                "metrics_evaluated": {},
                "metrics_coverage": 0.0,
                "breakdown": {},
            }

    # Comparative summary if multiple tickers
    comparative_summary = None
    if len(health_scores) > 1:
        from backend.scoring import HealthScoreResult

        score_objects = {}
        for sym, data in health_scores.items():
            if data.get("metrics_coverage", 0) > 0:
                score_objects[sym] = HealthScoreResult(
                    score=data["score"],
                    status=data["status"],
                    metrics_evaluated=data["metrics_evaluated"],
                    metrics_coverage=data["metrics_coverage"],
                    breakdown=data["breakdown"],
                )

        if score_objects:
            comparative_summary = calculate_comparative_score(score_objects)

    # --- Phase 3: News sentiment ---
    news_sentiment = summarize_news_sentiment(news_data)

    # --- Phase 4: LLM narrative synthesis ---
    scores_for_llm = {
        sym: {"score": d["score"], "status": d["status"], "metrics": d["metrics_evaluated"]}
        for sym, d in health_scores.items()
    }

    context_str = optimize_for_llm(
        company_data=company_data if not isinstance(company_data, Exception) else None,
        news_data=news_data if not isinstance(news_data, Exception) else None,
        scores=scores_for_llm,
    )

    narrative = await _call_llm(
        user_message=user_query,
        context_data=context_str,
        session_history=session_history,
    )

    # Record assistant turn
    memory.add_turn(session_id, "assistant", narrative)

    # --- Phase 5: Assemble response ---
    response = {
        "tickers_analyzed": normalized_tickers,
        "health_scores": health_scores,
        "comparative_summary": comparative_summary,
        "company_info": company_infos,
        "news_sentiment": news_sentiment,
        "narrative": narrative,
        "disclaimer": get_disclaimer(),
        "session_id": session_id,
    }

    logger.info(
        f"Analysis complete for {normalized_tickers} — "
        f"scores: {[(s, d['score']) for s, d in health_scores.items()]}"
    )

    return response
