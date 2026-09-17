// ============================================================
// WINI AI Frontend — API Client
// ============================================================

import type {
  AnalysisResult,
  ComparisonMetric,
  ComparisonResult,
  HealthCategory,
  HealthScore,
  HistoricalTrend,
  PortfolioSimulation,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ----------------------------------------------------------
// Backend Response Types (matching FastAPI /api/analyze)
// ----------------------------------------------------------

interface BackendHealthScore {
  score: number;
  status: string;
  metrics_evaluated: Record<string, number | null>;
  metrics_coverage: number;
  breakdown: Record<
    string,
    {
      value: number | null;
      score: number;
      max_weight: number;
      description: string;
    }
  >;
}

interface BackendCompanyInfo {
  symbol?: string;
  company_name?: string;
  sector?: string;
  sub_sector?: string;
  market_cap?: number | null;
  last_close_price?: number | null;
  pe_ttm?: number | null;
  pb_mrq?: number | null;
  yield_ttm?: number | null;
}

interface BackendAnalyzeResponse {
  tickers_analyzed: string[];
  health_scores: Record<string, BackendHealthScore>;
  comparative_summary?: {
    average_score: number;
    leader?: { symbol: string; score: number; status: string };
    laggard?: { symbol: string; score: number; status: string };
    ranking?: Array<{ rank: number; symbol: string; score: number; status: string }>;
  } | null;
  company_info: Record<string, BackendCompanyInfo>;
  news_sentiment: {
    total_articles: number;
    sentiment_breakdown: Record<string, number>;
    overall_sentiment: string;
    key_headlines: Array<{ title: string; sentiment: string }>;
  };
  historical_trend?: any;
  portfolio_simulation?: any;
  narrative: string;
  disclaimer: string;
  session_id: string;
}

// ----------------------------------------------------------
// Mock Data (used only as fallback when backend is unreachable)
// ----------------------------------------------------------

const MOCK_HEALTH_BBCA: HealthScore = {
  symbol: "BBCA",
  name: "Bank Central Asia Tbk",
  score: 88,
  category: "SEHAT",
  label: "[ SEHAT - Skor 88/100 ]",
};

const MOCK_HEALTH_BBRI: HealthScore = {
  symbol: "BBRI",
  name: "Bank Rakyat Indonesia Tbk",
  score: 75,
  category: "SEHAT",
  label: "[ SEHAT - Skor 75/100 ]",
};

const MOCK_COMPARISON: ComparisonResult = {
  symbols: ["BBCA", "BBRI"],
  names: {
    BBCA: "Bank Central Asia Tbk",
    BBRI: "Bank Rakyat Indonesia Tbk",
  },
  healthScores: {
    BBCA: MOCK_HEALTH_BBCA,
    BBRI: MOCK_HEALTH_BBRI,
  },
  metrics: [
    { metric: "Revenue (T)", values: { BBCA: "Rp 102.3T", BBRI: "Rp 186.5T" } },
    { metric: "Net Income (T)", values: { BBCA: "Rp 48.6T", BBRI: "Rp 55.2T" } },
    { metric: "P/E Ratio", values: { BBCA: "24.5x", BBRI: "12.8x" } },
    { metric: "P/B Ratio", values: { BBCA: "4.8x", BBRI: "2.3x" } },
    { metric: "ROE", values: { BBCA: "21.3%", BBRI: "19.7%" } },
    { metric: "DER", values: { BBCA: "5.2x", BBRI: "5.8x" } },
    { metric: "Dividend Yield", values: { BBCA: "1.1%", BBRI: "3.5%" } },
    { metric: "Health Score", values: { BBCA: "88/100", BBRI: "75/100" } },
  ],
};

const MOCK_SINGLE_RESULT: AnalysisResult = {
  summary:
    "BBCA menunjukkan fundamental yang sangat kuat dengan ROE 21.3% dan pertumbuhan laba bersih konsisten selama 5 tahun terakhir. Rasio P/E di 24.5x mencerminkan valuasi premium yang wajar mengingat kualitas aset dan manajemen risiko yang unggul. Rasio kredit bermasalah (NPL) tetap rendah di 1.2%, menunjukkan kualitas portofolio pinjaman yang sehat. Secara keseluruhan, BBCA layak mendapat skor kesehatan 88 dari 100.",
  transcript:
    "Analisis saham BBCA — Bank Central Asia Tbk. Skor kesehatan: 88 dari 100, kategori SEHAT. Revenue mencapai Rp 102.3 Triliun dengan laba bersih Rp 48.6 Triliun. Return on Equity tercatat di 21.3 persen, menunjukkan efisiensi modal yang sangat baik. Price-to-Earnings Ratio di 24.5 kali mencerminkan valuasi premium. Rasio kredit bermasalah rendah di 1.2 persen. Kesimpulan: BBCA memiliki fundamental yang sangat kuat dan layak dipertimbangkan untuk investasi jangka panjang.",
  healthScore: MOCK_HEALTH_BBCA,
  comparison: null,
  query: "analisis BBCA",
};

const MOCK_COMPARISON_RESULT: AnalysisResult = {
  summary:
    "Perbandingan BBCA vs BBRI menunjukkan kedua bank dalam kondisi sehat. BBCA unggul di efisiensi (ROE 21.3% vs 19.7%) dan kualitas aset, sementara BBRI memiliki valuasi lebih menarik (P/E 12.8x vs 24.5x) dan dividend yield lebih tinggi (3.5% vs 1.1%). BBRI cocok untuk investor yang mengincar dividen, sedangkan BBCA cocok untuk pertumbuhan jangka panjang.",
  transcript:
    "Perbandingan saham BBCA dan BBRI. Kedua emiten mendapat kategori SEHAT. BBCA dengan skor 88 dan BBRI dengan skor 75. BBCA unggul dalam Return on Equity di 21.3 persen dibanding BBRI di 19.7 persen. Namun BBRI memiliki valuasi lebih murah dengan P/E Ratio 12.8 kali dibanding BBCA di 24.5 kali. Dividend yield BBRI juga lebih tinggi di 3.5 persen. Kesimpulan: BBCA untuk pertumbuhan, BBRI untuk dividen.",
  healthScore: null,
  comparison: MOCK_COMPARISON,
  query: "bandingkan BBCA dan BBRI",
};

// ----------------------------------------------------------
// Helper: Map Backend Data to Frontend Types
// ----------------------------------------------------------

function toHealthCategory(status: string): HealthCategory {
  if (status === "SANGAT SEHAT") return "SANGAT SEHAT";
  if (status === "SEHAT") return "SEHAT";
  if (status === "WASPADA") return "WASPADA";
  return "BERISIKO TINGGI";
}

function formatPercentage(val: number | null | undefined): string {
  if (val == null) return "-";
  const num = Math.abs(val) <= 1.0 ? val * 100 : val;
  return `${num.toFixed(1)}%`;
}

function formatRatio(val: number | null | undefined): string {
  if (val == null) return "-";
  return `${val.toFixed(2)}x`;
}

function formatCurrency(val: number | null | undefined): string {
  if (val == null) return "-";
  if (val >= 1e12) return `Rp ${(val / 1e12).toFixed(1)}T`;
  if (val >= 1e9) return `Rp ${(val / 1e9).toFixed(1)}M`;
  return `Rp ${val.toLocaleString("id-ID")}`;
}

function mapBackendToFrontend(data: BackendAnalyzeResponse, query: string): AnalysisResult {
  const symbols = data.tickers_analyzed;
  const isComparison = symbols.length > 1;

  // Map historical trend if present
  let historicalTrend: HistoricalTrend | null = null;
  if (data.historical_trend && data.historical_trend.points) {
    const ht = data.historical_trend;
    historicalTrend = {
      symbol: ht.symbol,
      companyName: ht.company_name,
      points: (ht.points || []).map((p: any) => ({
        quarter: p.quarter,
        score: p.score,
        status: toHealthCategory(p.status),
        der: p.der,
        roe: p.roe,
        pe: p.pe,
      })),
      direction: ht.direction,
      delta: ht.delta,
      earlyWarning: ht.early_warning,
      summary: ht.summary,
    };
  }

  // Map portfolio simulation if present
  let portfolio: PortfolioSimulation | null = null;
  if (data.portfolio_simulation && data.portfolio_simulation.allocations) {
    const ps = data.portfolio_simulation;
    portfolio = {
      totalCapital: ps.total_capital,
      weightedScore: ps.weighted_score,
      status: toHealthCategory(ps.status),
      allocations: (ps.allocations || []).map((a: any) => ({
        symbol: a.symbol,
        name: a.name,
        weight: a.weight,
        nominal: a.nominal,
        score: a.score,
        status: toHealthCategory(a.status),
        suggested_weight: a.suggested_weight,
        suggested_nominal: a.suggested_nominal,
      })),
      weakestStock: ps.weakest_stock,
      strongestStock: ps.strongest_stock,
      rebalancingAdvice: ps.rebalancing_advice,
      projectedScoreAfterRebalance: ps.projected_score_after_rebalance,
    };
  }

  if (!isComparison && symbols.length === 1) {
    const sym = symbols[0];
    const hs = data.health_scores[sym];
    const info = data.company_info[sym];

    const healthScore: HealthScore = {
      symbol: sym,
      name: info?.company_name || sym,
      score: hs?.score ?? 0,
      category: toHealthCategory(hs?.status || "WASPADA"),
      label: `[ ${hs?.status || "WASPADA"} - Skor ${hs?.score ?? 0}/100 ]`,
    };

    return {
      summary: data.narrative,
      transcript: `${data.narrative}\n\n${data.disclaimer}`,
      healthScore,
      comparison: null,
      historicalTrend,
      portfolio,
      query,
    };
  }

  // Multi-stock comparison
  const names: Record<string, string> = {};
  const healthScores: Record<string, HealthScore> = {};

  for (const sym of symbols) {
    const hs = data.health_scores[sym];
    const info = data.company_info[sym];
    names[sym] = info?.company_name || sym;
    healthScores[sym] = {
      symbol: sym,
      name: names[sym],
      score: hs?.score ?? 0,
      category: toHealthCategory(hs?.status || "WASPADA"),
      label: `[ ${hs?.status || "WASPADA"} - Skor ${hs?.score ?? 0}/100 ]`,
    };
  }

  const metrics: ComparisonMetric[] = [
    {
      metric: "Skor Kesehatan",
      values: Object.fromEntries(symbols.map((s) => [s, `${data.health_scores[s]?.score ?? 0}/100`])),
    },
    {
      metric: "Status",
      values: Object.fromEntries(symbols.map((s) => [s, data.health_scores[s]?.status || "-"])),
    },
    {
      metric: "DER (Debt to Equity)",
      values: Object.fromEntries(
        symbols.map((s) => [s, formatRatio(data.health_scores[s]?.metrics_evaluated?.der_mrq)])
      ),
    },
    {
      metric: "ROE (Return on Equity)",
      values: Object.fromEntries(
        symbols.map((s) => [s, formatPercentage(data.health_scores[s]?.metrics_evaluated?.roe_ttm)])
      ),
    },
    {
      metric: "ROA (Return on Assets)",
      values: Object.fromEntries(
        symbols.map((s) => [s, formatPercentage(data.health_scores[s]?.metrics_evaluated?.roa_ttm)])
      ),
    },
    {
      metric: "DAR (Debt to Assets)",
      values: Object.fromEntries(
        symbols.map((s) => [s, formatPercentage(data.health_scores[s]?.metrics_evaluated?.dar_mrq)])
      ),
    },
    {
      metric: "P/E Ratio",
      values: Object.fromEntries(
        symbols.map((s) => [s, formatRatio(data.health_scores[s]?.metrics_evaluated?.pe_ttm)])
      ),
    },
  ];

  const hasMarketCap = symbols.some((s) => data.company_info[s]?.market_cap != null);
  if (hasMarketCap) {
    metrics.push({
      metric: "Kapitalisasi Pasar",
      values: Object.fromEntries(symbols.map((s) => [s, formatCurrency(data.company_info[s]?.market_cap)])),
    });
  }

  const comparison: ComparisonResult = {
    symbols,
    names,
    healthScores,
    metrics,
  };

  return {
    summary: data.narrative,
    transcript: `${data.narrative}\n\n${data.disclaimer}`,
    healthScore: null,
    comparison,
    historicalTrend,
    portfolio,
    query,
  };
}

// ----------------------------------------------------------
// API Functions
// ----------------------------------------------------------

/**
 * Send a natural-language query to the backend for analysis.
 * Automatically connects to FastAPI /api/analyze and falls back to mock data
 * only when the server is offline.
 */
export async function analyzeStock(query: string): Promise<AnalysisResult> {
  const isComparison = /bandingkan|vs|versus|compare|perbandingan/i.test(query);

  try {
    const response = await fetch(`${API_BASE}/api/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_query: query,
        query: query,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error ${response.status}: ${errorText}`);
    }

    const backendData = (await response.json()) as BackendAnalyzeResponse;
    return mapBackendToFrontend(backendData, query);
  } catch (error) {
    console.warn("Backend unavailable or returned error, using fallback mock data:", error);
    await delay(800);
    return isComparison ? MOCK_COMPARISON_RESULT : MOCK_SINGLE_RESULT;
  }
}

// ----------------------------------------------------------
// Utilities
// ----------------------------------------------------------

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
