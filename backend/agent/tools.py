"""Agent Tools & Registry for WINI AI Autonomous Investment Analyst.

Defines the explicit toolset used by the WINI AI Agent:
- Multi-step tool execution with timing and tracing
- Ground-truth data retrieval from Sectors Financial API v2
- Deterministic mathematical evaluation (zero-hallucination guardrail)
- Quantitative portfolio rebalancing and quarterly trend analysis
"""

from __future__ import annotations

import time
import logging
from dataclasses import dataclass, field
from typing import Any, Callable, Awaitable

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
    HealthScoreResult,
)

logger = logging.getLogger(__name__)


@dataclass
class ToolExecutionResult:
    """Result of an individual agent tool execution."""
    tool_name: str
    category: str  # "DATA_RETRIEVAL" | "QUANTITATIVE_ANALYSIS" | "SYNTHESIS" | "GUARDRAIL"
    duration_ms: int
    status: str    # "SUCCESS" | "FALLBACK" | "ERROR"
    summary: str
    data: Any = None


@dataclass
class AgentTool:
    """Formal definition of a tool available to the agent."""
    name: str
    category: str
    description: str
    func: Callable[..., Awaitable[Any]]

    async def execute(self, **kwargs) -> ToolExecutionResult:
        """Execute the tool and capture telemetry/trace."""
        start_time = time.perf_counter()
        try:
            result = await self.func(**kwargs)
            duration_ms = int((time.perf_counter() - start_time) * 1000)
            
            # Formulate human-readable summary
            summary = self._generate_summary(result)
            return ToolExecutionResult(
                tool_name=self.name,
                category=self.category,
                duration_ms=duration_ms,
                status="SUCCESS",
                summary=summary,
                data=result,
            )
        except Exception as e:
            duration_ms = int((time.perf_counter() - start_time) * 1000)
            logger.error(f"Tool {self.name} failed: {e}")
            return ToolExecutionResult(
                tool_name=self.name,
                category=self.category,
                duration_ms=duration_ms,
                status="ERROR",
                summary=f"Gagal mengeksekusi tool: {str(e)[:60]}",
                data=None,
            )

    def _generate_summary(self, result: Any) -> str:
        if self.name == "sectors_fundamentals":
            count = len(result) if isinstance(result, list) else 0
            return f"Mengambil data fundamental resmi untuk {count} emiten dari Sectors API v2"
        elif self.name == "market_intelligence_news":
            count = len(result) if isinstance(result, list) else 0
            return f"Mengumpulkan {count} artikel berita pasar modal untuk analisis sentimen"
        elif self.name == "deterministic_health_scorer":
            return "Menghitung skor kesehatan finansial 100 poin secara matematis deterministik"
        elif self.name == "historical_trend_analyzer":
            direction = result.get("direction", "STAGNAN") if isinstance(result, dict) else "STAGNAN"
            return f"Mengevaluasi tren fundamental 4 kuartal (Status: {direction})"
        elif self.name == "portfolio_rebalancer":
            score = result.get("weighted_score", 0) if isinstance(result, dict) else 0
            return f"Mengoptimasi alokasi portofolio (Skor Terbobot: {score}/100)"
        return "Eksekusi tool selesai"


class AgentToolRegistry:
    """Registry managing all tools callable by WINI AI."""

    def __init__(self):
        self._tools: dict[str, AgentTool] = {}
        self._register_default_tools()

    def register(self, tool: AgentTool) -> None:
        self._tools[tool.name] = tool

    def get(self, name: str) -> AgentTool | None:
        return self._tools.get(name)

    def list_tools(self) -> list[dict[str, str]]:
        return [
            {
                "name": t.name,
                "category": t.category,
                "description": t.description,
            }
            for t in self._tools.values()
        ]

    def _register_default_tools(self):
        # 1. Tool Data Retrieval: Fundamentals
        async def _fetch_fundamentals(tickers: list[str]):
            return await fetch_company_fundamentals(tickers)

        self.register(
            AgentTool(
                name="sectors_fundamentals",
                category="DATA_RETRIEVAL",
                description="Mengambil data neraca keuangan, valuasi, solvabilitas, dan dividen dari Sectors Financial API v2.",
                func=_fetch_fundamentals,
            )
        )

        # 2. Tool Data Retrieval: News
        async def _fetch_news_tool(tickers: list[str]):
            return await fetch_news(symbols=tickers, limit=5)

        self.register(
            AgentTool(
                name="market_intelligence_news",
                category="DATA_RETRIEVAL",
                description="Mengambil berita pasar modal terkini yang terverifikasi untuk analisis sentimen emiten.",
                func=_fetch_news_tool,
            )
        )

        # 3. Tool Quantitative: Deterministic Scorer
        async def _score_health(company_data: list[dict[str, Any]]):
            scores = {}
            infos = {}
            for comp in company_data:
                sym = comp.get("symbol", "").replace(".JK", "")
                if not sym:
                    continue
                metrics = extract_metrics(comp)
                res = calculate_health_score(metrics)
                scores[sym] = res
                infos[sym] = extract_company_info(comp)
            return {"scores": scores, "company_infos": infos}

        self.register(
            AgentTool(
                name="deterministic_health_scorer",
                category="QUANTITATIVE_ANALYSIS",
                description="Menghitung skor kesehatan finansial skala 100 poin dengan formula deterministik matematis (DER, ROE, ROA, DAR, PE).",
                func=_score_health,
            )
        )

        # 4. Tool Quantitative: Historical Trend
        async def _analyze_trend(company: dict[str, Any], company_name: str):
            sym = company.get("symbol", "").replace(".JK", "")
            q_history = extract_quarterly_history(company)
            return calculate_quarterly_trend(sym, company_name, q_history)

        self.register(
            AgentTool(
                name="historical_trend_analyzer",
                category="QUANTITATIVE_ANALYSIS",
                description="Menganalisis lintasan performa 4 kuartal berturut-turut untuk mendeteksi arah tren dan sinyal peringatan dini.",
                func=_analyze_trend,
            )
        )

        # 5. Tool Quantitative: Portfolio Rebalancer
        async def _simulate_port(ticker_scores: dict[str, HealthScoreResult], company_names: dict[str, str], capital: float):
            return simulate_portfolio(ticker_scores, company_names, capital)

        self.register(
            AgentTool(
                name="portfolio_rebalancer",
                category="QUANTITATIVE_ANALYSIS",
                description="Menghitung alokasi modal nominal dan memberikan rekomendasi pembobotan ulang portofolio cerdas.",
                func=_simulate_port,
            )
        )


# Global registry singleton
_registry_instance: AgentToolRegistry | None = None


def get_tool_registry() -> AgentToolRegistry:
    global _registry_instance
    if _registry_instance is None:
        _registry_instance = AgentToolRegistry()
    return _registry_instance
