"""WINI AI Backend — FastAPI application.

Autonomous Investment Analyst & Comparative Stock Screener.
Serves the POST /api/analyze endpoint and health check.
"""

from __future__ import annotations

import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from backend.agent.agent_core import analyze
from backend.disclaimers import get_disclaimer
from backend.cache import get_cache

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


# --- Pydantic Models ---


# Common Indonesian company names mapped to IDX ticker symbols
COMPANY_NAME_TO_TICKER: dict[str, str] = {
    "telkom": "TLKM",
    "indosat": "ISAT",
    "bca": "BBCA",
    "bri": "BBRI",
    "mandiri": "BMRI",
    "bni": "BBNI",
    "astra": "ASII",
    "unilever": "UNVR",
    "goto": "GOTO",
    "gojek": "GOTO",
    "tokopedia": "GOTO",
    "adaro": "ADRO",
    "antam": "ANTM",
    "vale": "INCO",
    "inco": "INCO",
    "bukalapak": "BUKA",
    "kalbe": "KLBF",
    "indofood": "INDF",
    "icbp": "ICBP",
    "semen indonesia": "SMGR",
    "smgr": "SMGR",
    "ptba": "PTBA",
    "bukit asam": "PTBA",
    "medco": "MEDC",
    "pgas": "PGAS",
    "perusahaan gas": "PGAS",
}

# Words to ignore when scanning text for tickers (Indonesian common words & commands)
COMMON_STOPWORDS_4 = {
    "YANG", "PADA", "DARI", "ATAU", "BANK", "SKOR", "LABA", "ATAS", "SAJA",
    "JUGA", "KITA", "BISA", "AKAN", "BAGI", "KAMI", "SAMA", "BILA", "AGAR",
    "OLEH", "LALU", "CARA", "LIMA", "ENAM", "SATU", "DUA", "INFO", "DATA",
    "NEWS", "APAK", "MANA", "RUGI", "AI", "VS", "DAN", "BAIK", "APAP", "DENG",
    "POST", "TEST", "NEXT", "HALO", "NAMA", "MAKA", "SAAT", "HARI", "BULAN",
    "COBA", "CARI", "LIAT", "BAGU", "BUAT", "MAUK", "TENT", "DULU", "SAYA",
    "KAMU", "APAS", "IKUT", "NAIK", "TURU", "JUAL", "BELI", "KATA", "KODE",
    "TOP5", "TOP3", "TOP7", "TOP8", "TOP9", "TOP1", "TOP0", "EMIT", "KALI",
    "CEK", "PILI", "SEDE", "SUDA", "BIAR", "TAPI", "JIKA", "TERB", "SEHA",
    "MENG", "SIAP", "DAPA", "TIDA", "BANY", "ADAL", "BEBE", "DEPA", "JADI"
}


def extract_tickers_from_text(text: str) -> list[str]:
    """Extract IDX ticker symbols dynamically from natural language query.

    IDX tickers are 4-letter symbols (e.g. BBCA, TLKM, DCII, BYAN, MEDC).
    Extracts any 4-letter token not belonging to common Indonesian stopwords,
    without requiring any hardcoded stock lists.
    """
    import re
    lower_text = text.lower()
    found: list[str] = []

    # 1. Check known company aliases (e.g. "telkom" -> TLKM, "bca" -> BBCA, "adaro" -> ADRO)
    for name, sym in COMPANY_NAME_TO_TICKER.items():
        if re.search(r"\b" + re.escape(name) + r"\b", lower_text):
            if sym not in found:
                found.append(sym)

    # 2. Check 4-letter words dynamically
    tokens = re.findall(r"\b[A-Za-z]{4}\b", text)
    for t in tokens:
        up = t.upper()
        if up not in COMMON_STOPWORDS_4 and up not in found:
            # If word was uppercase or no aliases found yet, accept as ticker candidate
            found.append(up)

    return found


class AnalyzeRequest(BaseModel):
    """Request body for the /api/analyze endpoint."""

    tickers: list[str] = Field(
        default_factory=list,
        max_length=10,
        description="List of IDX ticker symbols (e.g. ['TLKM', 'ISAT']). Auto-extracted from query if omitted.",
        examples=[["TLKM", "ISAT"]],
    )
    user_query: str | None = Field(
        default=None,
        max_length=500,
        description="User's analysis question in natural language",
        examples=["Bandingkan kesehatan keuangan Telkom dan Indosat"],
    )
    query: str | None = Field(
        default=None,
        max_length=500,
        description="Convenience alias for user_query",
    )
    session_id: str | None = Field(
        default=None,
        description="Optional session ID for conversation continuity",
    )


class MetricsEvaluated(BaseModel):
    """Financial metrics used in scoring."""

    der_mrq: float | None = None
    roe_ttm: float | None = None
    roa_ttm: float | None = None
    dar_mrq: float | None = None
    pe_ttm: float | None = None


class HealthScore(BaseModel):
    """Health score for a single ticker."""

    score: int = Field(description="Health score 0-100")
    status: str = Field(description="SEHAT | WASPADA | BERISIKO TINGGI")
    metrics_evaluated: dict = Field(description="Metric values used")
    metrics_coverage: float = Field(description="Fraction of metrics available (0-1)")
    breakdown: dict = Field(default_factory=dict, description="Per-metric score breakdown")


class NewsSummary(BaseModel):
    """News sentiment summary."""

    total_articles: int = 0
    sentiment_breakdown: dict = Field(default_factory=dict)
    overall_sentiment: str = "NETRAL"
    key_headlines: list[dict] = Field(default_factory=list)


class CompanyInfo(BaseModel):
    """Basic company information."""

    symbol: str = ""
    company_name: str = ""
    sector: str = ""
    sub_sector: str = ""
    market_cap: float | None = None
    last_close_price: float | None = None


class AnalyzeResponse(BaseModel):
    """Response body for the /api/analyze endpoint."""

    tickers_analyzed: list[str]
    health_scores: dict[str, HealthScore]
    comparative_summary: dict | None = None
    company_info: dict[str, dict] = Field(default_factory=dict)
    news_sentiment: NewsSummary
    narrative: str
    disclaimer: str
    session_id: str


# --- App Lifecycle ---


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle manager."""
    logger.info("🚀 WINI AI Backend starting up...")
    yield
    # Cleanup
    cache = get_cache()
    await cache.clear()
    logger.info("👋 WINI AI Backend shutting down...")


# --- FastAPI App ---

app = FastAPI(
    title="WINI AI Backend",
    description=(
        "Autonomous Investment Analyst & Comparative Stock Screener "
        "for IDX-listed companies. Powered by Sectors Financial API."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Endpoints ---


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "ok",
        "service": "wini-ai-backend",
        "timestamp": time.time(),
    }


DISCOVERY_KEYWORDS = {
    "top", "bagus", "terbaik", "sehat", "rekomendasi", "menarik",
    "screener", "saring", "pilihan", "unggul", "beli", "investasi"
}


def is_discovery_query(text: str) -> bool:
    """Check if query is asking for stock discovery / recommendations."""
    lower = text.lower()
    return any(kw in lower for kw in DISCOVERY_KEYWORDS)


def extract_requested_limit(text: str, default: int = 5) -> int:
    """Extract requested number of stocks (e.g. 'top 5' -> 5)."""
    import re
    m = re.search(r"\btop\s*(\d+)\b", text.lower())
    if m:
        try:
            val = int(m.group(1))
            return max(1, min(val, 10))
        except ValueError:
            pass
    return default


@app.post("/api/analyze", response_model=AnalyzeResponse)
async def analyze_endpoint(request: AnalyzeRequest):
    """Run comparative financial analysis on IDX-listed companies.

    Accepts one or more ticker symbols and a natural language query.
    If tickers are omitted, extracts ticker symbols automatically from the query.
    If no tickers are found but discovery intent is detected (e.g. "top 5 saham bagus"),
    screens the healthiest stocks automatically.
    Returns health scores, news sentiment, and an AI-generated narrative.
    """
    effective_query = (request.user_query or request.query or "").strip()
    if not effective_query:
        raise HTTPException(status_code=400, detail="Query tidak boleh kosong.")

    # Normalize or auto-extract tickers
    tickers = [t.strip().upper().replace(".JK", "") for t in request.tickers if t.strip()]
    if not tickers:
        tickers = extract_tickers_from_text(effective_query)

    # Auto-screener for discovery queries (e.g. "top 5 saham yang sedang bagus")
    if not tickers and is_discovery_query(effective_query):
        limit = extract_requested_limit(effective_query, default=5)
        logger.info(f"Discovery query detected: '{effective_query}', auto-screening top {limit} stocks...")
        from backend.services.sectors_service import screen_top_healthy_companies
        screened = await screen_top_healthy_companies(limit=limit)
        tickers = [c.get("symbol", "").replace(".JK", "") for c in screened if c.get("symbol")]

    if not tickers:
        raise HTTPException(
            status_code=400,
            detail=(
                "Tidak dapat mendeteksi kode saham dalam pertanyaan. "
                "Sertakan kode saham atau nama emiten (contoh: 'analisis BBCA' atau 'bandingkan TLKM dan ISAT'), "
                "atau gunakan perintah rekomendasi seperti 'analisis top 5 saham yang sedang bagus'."
            ),
        )

    logger.info(
        f"Analyze request: tickers={tickers}, "
        f"query='{effective_query[:80]}...'"
    )

    try:
        result = await analyze(
            tickers=tickers,
            user_query=effective_query,
            session_id=request.session_id,
        )

        return AnalyzeResponse(
            tickers_analyzed=result["tickers_analyzed"],
            health_scores={
                k: HealthScore(**v) for k, v in result["health_scores"].items()
            },
            comparative_summary=result.get("comparative_summary"),
            company_info=result.get("company_info", {}),
            news_sentiment=NewsSummary(**result["news_sentiment"]),
            narrative=result["narrative"],
            disclaimer=result["disclaimer"],
            session_id=result["session_id"],
        )

    except ValueError as e:
        logger.warning(f"Validation error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

    except Exception as e:
        logger.error(f"Analysis failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=(
                "Terjadi kesalahan saat memproses analisis. "
                "Silakan coba lagi dalam beberapa saat."
            ),
        )
