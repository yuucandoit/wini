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
import time
import uuid
from typing import Any

from backend.config import get_settings
from backend.services.sectors_service import (
    fetch_company_fundamentals,
    extract_metrics,
    extract_company_info,
    extract_quarterly_history,
)
from backend.services.news_service import (
    fetch_news,
    summarize_news_sentiment,
)
from backend.scoring import (
    calculate_health_score,
    calculate_comparative_score,
    calculate_quarterly_trend,
    simulate_portfolio,
)
from backend.optimizer import optimize_for_llm
from backend.disclaimers import get_disclaimer
from backend.guardrail import verify_narrative, build_deterministic_narrative
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
    "\n9. JANGAN memakai kata 'rekomendasi', 'sebaiknya beli/jual', atau 'saran investasi'. "
    "Gunakan 'gambaran', 'pertimbangan', atau 'hal yang perlu diperhatikan' (kepatuhan OJK)."
    "\n10. Jika data menyebut catatan (notes) seperti rugi, ekuitas negatif, data tidak lengkap, "
    "atau penyesuaian sektor keuangan, sebutkan secara jelas."
    "\n11. Jika ada penurunan/kenaikan skor, jelaskan penyebabnya dari metrik (mis. DER naik) hanya bila angkanya ada di data."
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

    # List of models to try in sequence if one fails or returns empty/429
    models_to_try = [settings.OPENROUTER_MODEL]
    for fallback in ["nvidia/nemotron-3.5-lightning:free", "openrouter/free"]:
        if fallback not in models_to_try:
            models_to_try.append(fallback)

    headers = {
        "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://wini-ai.app",
        "X-Title": "WINI AI Investment Analyst",
    }
    url = f"{settings.OPENROUTER_BASE_URL}/chat/completions"

    import re

    for model_name in models_to_try:
        payload = {
            "model": model_name,
            "messages": messages,
            "max_tokens": 1200,
            "temperature": 0.3,
        }

        try:
            async with httpx.AsyncClient(timeout=LLM_TIMEOUT) as client:
                response = await client.post(url, json=payload, headers=headers)
                if response.status_code != 200:
                    logger.warning(f"Model {model_name} HTTP {response.status_code}: {response.text[:120]}")
                    continue
                data = response.json()

            choices = data.get("choices", [])
            if choices:
                msg = choices[0].get("message", {}) or {}
                # Extract text from content or reasoning (for thinking/reasoning models)
                raw_content = msg.get("content") or msg.get("reasoning") or choices[0].get("text") or ""
                if not isinstance(raw_content, str):
                    raw_content = str(raw_content or "")

                # Clean thinking tags from reasoning models
                cleaned_content = re.sub(r"<think>.*?</think>", "", raw_content, flags=re.DOTALL)
                cleaned_content = re.sub(r"^Here's a thinking process:.*?\n\n", "", cleaned_content, flags=re.DOTALL | re.IGNORECASE)
                cleaned_content = cleaned_content.strip()

                if cleaned_content:
                    return cleaned_content

            logger.warning(f"Model {model_name} returned empty content, trying fallback model...")

        except httpx.TimeoutException:
            logger.warning(f"Model {model_name} timed out after {LLM_TIMEOUT}s, trying fallback model...")
        except Exception as e:
            logger.warning(f"Model {model_name} error: {e}, trying fallback model...")

    logger.error("All OpenRouter candidate models failed or returned empty content.")
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
    pipeline_start = time.perf_counter()
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

    async def _timed(coro):
        """Jalankan coroutine dan ukur durasi NYATA-nya (ms)."""
        t0 = time.perf_counter()
        try:
            value = await coro
            return value, int((time.perf_counter() - t0) * 1000), None
        except Exception as exc:  # noqa: BLE001
            return None, int((time.perf_counter() - t0) * 1000), exc

    (company_data, company_ms, company_err), (news_data, news_ms, news_err) = await asyncio.gather(
        _timed(fetch_company_fundamentals(normalized_tickers)),
        _timed(fetch_news(symbols=normalized_tickers, limit=5)),
    )

    # Handle partial failures gracefully
    if company_err is not None or not isinstance(company_data, list):
        logger.error(f"Company data fetch failed: {company_err}")
        company_data = []
    if news_err is not None or not isinstance(news_data, list):
        logger.warning(f"News data fetch failed: {news_err}")
        news_data = []

    mock_mode = get_settings().USE_MOCK_DATA
    data_source = "fixture lokal (mock)" if mock_mode else "Sectors API v2 (live, bisa dari cache)"
    tool_steps = [
        {
            "tool": "sectors_fundamentals",
            "category": "DATA_RETRIEVAL",
            "duration_ms": company_ms,
            "status": "SUCCESS" if company_data else "FALLBACK",
            "summary": f"Mengambil data fundamental {len(company_data)} emiten dari {data_source}",
        },
        {
            "tool": "market_intelligence_news",
            "category": "DATA_RETRIEVAL",
            "duration_ms": news_ms,
            "status": "SUCCESS" if news_data else "FALLBACK",
            "summary": f"Mengumpulkan {len(news_data)} artikel berita untuk analisis sentimen",
        },
    ]

    # --- Phase 2: Deterministic scoring ---
    score_start = time.perf_counter()
    health_scores: dict[str, dict[str, Any]] = {}
    company_infos: dict[str, dict[str, Any]] = {}

    for company in company_data:
        symbol = company.get("symbol", "").replace(".JK", "")
        if not symbol:
            continue

        company_infos[symbol] = extract_company_info(company)
        metrics = extract_metrics(company)
        score_result = calculate_health_score(
            metrics, sector=company_infos[symbol].get("sector")
        )

        health_scores[symbol] = {
            "score": score_result.score,
            "status": score_result.status,
            "metrics_evaluated": score_result.metrics_evaluated,
            "metrics_coverage": score_result.metrics_coverage,
            "breakdown": score_result.breakdown,
            "notes": score_result.notes,
        }

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

    score_duration_ms = max(1, int((time.perf_counter() - score_start) * 1000))
    tool_steps.append({
        "tool": "deterministic_health_scorer",
        "category": "QUANTITATIVE_ANALYSIS",
        "duration_ms": score_duration_ms,
        "status": "SUCCESS",
        "summary": f"Menghitung skor kesehatan deterministik 100 poin (DER, ROE, ROA, DAR, PE) untuk {len(health_scores)} emiten",
    })

    # --- Phase 2b: Historical Quarterly Trend (if query asks for trend/quarters) ---
    historical_trend = None
    lower_query = user_query.lower()
    is_trend_query = any(k in lower_query for k in ["tren", "kuartal", "quarter", "historis", "perkembangan"])
    if is_trend_query and company_data and isinstance(company_data, list) and len(company_data) > 0:
        trend_start = time.perf_counter()
        primary_comp = company_data[0]
        sym = primary_comp.get("symbol", "").replace(".JK", "")
        comp_name = company_infos.get(sym, {}).get("company_name", sym)
        q_history = extract_quarterly_history(primary_comp)
        historical_trend = calculate_quarterly_trend(sym, comp_name, q_history)
        tool_steps.append({
            "tool": "historical_trend_analyzer",
            "category": "QUANTITATIVE_ANALYSIS",
            "duration_ms": max(1, int((time.perf_counter() - trend_start) * 1000)),
            "status": "SUCCESS",
            "summary": f"Mengevaluasi lintasan fundamental 4 kuartal emiten {sym} (Arah: {historical_trend.get('direction', 'STAGNAN')})",
        })

    # --- Phase 2c: Portfolio Simulation (if query asks for portfolio/simulation/investment) ---
    portfolio_simulation = None
    is_portfolio_query = any(k in lower_query for k in ["portofolio", "portfolio", "simulasi", "taruh", "alokasi", "modal"])
    if is_portfolio_query and len(health_scores) >= 1:
        port_start = time.perf_counter()
        from backend.scoring import HealthScoreResult
        score_objs = {
            sym: HealthScoreResult(
                score=d["score"],
                status=d["status"],
                metrics_evaluated=d["metrics_evaluated"],
                metrics_coverage=d["metrics_coverage"],
                breakdown=d["breakdown"],
            )
            for sym, d in health_scores.items()
            if d.get("metrics_coverage", 0) > 0
        }
        if score_objs:
            import re
            capital = 10_000_000.0
            # Extract nominal from query: e.g. "10 juta", "50jt", "10000000"
            m_juta = re.search(r"(\d+(?:[.,]\d+)?)\s*(?:juta|jt)\b", lower_query)
            if m_juta:
                try:
                    capital = float(m_juta.group(1).replace(",", ".")) * 1_000_000.0
                except ValueError:
                    pass
            else:
                m_num = re.search(r"\b(\d{6,12})\b", lower_query)
                if m_num:
                    try:
                        capital = float(m_num.group(1))
                    except ValueError:
                        pass

            comp_names = {sym: company_infos.get(sym, {}).get("company_name", sym) for sym in score_objs}
            portfolio_simulation = simulate_portfolio(
                ticker_scores=score_objs,
                company_names=comp_names,
                total_capital=capital,
            )
            tool_steps.append({
                "tool": "portfolio_rebalancer",
                "category": "QUANTITATIVE_ANALYSIS",
                "duration_ms": max(1, int((time.perf_counter() - port_start) * 1000)),
                "status": "SUCCESS",
                "summary": f"Mengoptimasi alokasi modal nominal (Skor Terbobot: {portfolio_simulation.get('weighted_score', 0)}/100)",
            })

    # --- Phase 3: News sentiment ---
    news_sentiment = summarize_news_sentiment(news_data)

    # --- Phase 4: LLM narrative synthesis ---
    scores_for_llm = {
        sym: {
            "score": d["score"],
            "status": d["status"],
            "metrics": d["metrics_evaluated"],
            "notes": d.get("notes", []),
        }
        for sym, d in health_scores.items()
    }

    # Add trend and portfolio metadata to context string if present
    extra_context = {}
    if historical_trend:
        extra_context["historical_trend"] = historical_trend
    if portfolio_simulation:
        extra_context["portfolio_simulation"] = portfolio_simulation

    context_str = optimize_for_llm(
        company_data=company_data if not isinstance(company_data, Exception) else None,
        news_data=news_data if not isinstance(news_data, Exception) else None,
        scores={**scores_for_llm, **extra_context},
    )

    llm_start = time.perf_counter()
    narrative = await _call_llm(
        user_message=user_query,
        context_data=context_str,
        session_history=session_history,
    )
    llm_duration_ms = max(1, int((time.perf_counter() - llm_start) * 1000))
    llm_failed = narrative == _fallback_narrative()
    tool_steps.append({
        "tool": "llm_narrative_synthesizer",
        "category": "SYNTHESIS",
        "duration_ms": llm_duration_ms,
        "status": "FALLBACK" if llm_failed else "SUCCESS",
        "summary": (
            "LLM tidak tersedia, memakai narasi deterministik"
            if llm_failed
            else f"Mensintesis narasi dengan model OpenRouter ({get_settings().OPENROUTER_MODEL} + fallback)"
        ),
    })

    # --- Phase 4b: Guardrail konsistensi angka ---
    guard_start = time.perf_counter()
    ground_truth = {
        "health_scores": health_scores,
        "company_infos": company_infos,
        "company_data": company_data,
        "news": news_data,
        "historical_trend": historical_trend,
        "portfolio": portfolio_simulation,
        "comparative": comparative_summary,
    }
    if llm_failed:
        guard = {"passed": True, "checked": 0, "unverified": []}
        narrative = build_deterministic_narrative(
            health_scores, historical_trend, portfolio_simulation
        )
        guard_action = "LLM gagal; narasi deterministik dipakai"
    else:
        guard = verify_narrative(narrative, ground_truth)
        if guard["passed"]:
            guard_action = f"{guard['checked']} angka pada narasi cocok dengan data hitung"
        else:
            logger.warning(f"Guardrail menolak narasi LLM; angka tak terverifikasi: {guard['unverified']}")
            narrative = build_deterministic_narrative(
                health_scores, historical_trend, portfolio_simulation
            )
            guard_action = (
                f"Narasi LLM DITOLAK: angka tidak terverifikasi {guard['unverified'][:5]}; "
                "diganti narasi deterministik"
            )
    tool_steps.append({
        "tool": "narrative_numeric_guardrail",
        "category": "GUARDRAIL",
        "duration_ms": max(1, int((time.perf_counter() - guard_start) * 1000)),
        "status": "SUCCESS" if guard["passed"] else "FALLBACK",
        "summary": guard_action,
    })

    # Record assistant turn
    memory.add_turn(session_id, "assistant", narrative)

    # --- Phase 5: Assemble response & Agent Trace ---
    total_duration_ms = max(1, int((time.perf_counter() - pipeline_start) * 1000))
    agent_trace = {
        "goal": f"Analisis fundamental terpadu untuk {', '.join(normalized_tickers) if normalized_tickers else user_query}",
        "session_id": session_id,
        "tools_executed": tool_steps,
        "guardrail_verification": {
            "passed": guard["passed"],
            "rule": (
                "Konsistensi angka: setiap angka dalam narasi LLM dicocokkan dengan hasil hitung "
                "deterministik. Tidak menjamin kebenaran opini kualitatif."
            ),
            "metrics_evaluated": guard["checked"],
            "unverified": guard["unverified"],
        },
        "data_source": "mock" if mock_mode else "live",
        "measured": True,
        "total_duration_ms": total_duration_ms,
    }

    response = {
        "tickers_analyzed": normalized_tickers,
        "health_scores": health_scores,
        "comparative_summary": comparative_summary,
        "company_info": company_infos,
        "news_sentiment": news_sentiment,
        "historical_trend": historical_trend,
        "portfolio_simulation": portfolio_simulation,
        "narrative": narrative,
        "agent_trace": agent_trace,
        "disclaimer": get_disclaimer(),
        "session_id": session_id,
    }

    logger.info(
        f"Analysis complete for {normalized_tickers} — "
        f"tools executed: {len(tool_steps)} in {total_duration_ms}ms"
    )

    return response
