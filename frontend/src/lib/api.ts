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

// ============================================================
// MODE SWITCH:
// 1. Defaults to environment variable NEXT_PUBLIC_USE_MOCK_DATA from .env.local
// 2. Can be toggled dynamically in real-time from the UI Switch Button (persisted in localStorage)
// ============================================================
export const isMockModeActive = (): boolean => {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("wini_mock_mode");
    if (stored !== null) {
      return stored === "true";
    }
  }
  return process.env.NEXT_PUBLIC_USE_MOCK_DATA !== undefined
    ? process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true"
    : true;
};

export const setMockModeActive = (active: boolean): void => {
  if (typeof window !== "undefined") {
    localStorage.setItem("wini_mock_mode", String(active));
    window.dispatchEvent(new CustomEvent("wini_mock_mode_changed", { detail: active }));
  }
};

// Legacy constant export
export const USE_MOCK_DATA = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";

// ----------------------------------------------------------
// Mock Data (used for offline testing or fallback)
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
  historicalTrend: null,
  portfolio: null,
  query: "analisis BBCA",
};

const MOCK_COMPARISON_RESULT: AnalysisResult = {
  summary:
    "Perbandingan BBCA vs BBRI menunjukkan kedua bank dalam kondisi sehat. BBCA unggul di efisiensi (ROE 21.3% vs 19.7%) dan kualitas aset, sementara BBRI memiliki valuasi lebih menarik (P/E 12.8x vs 24.5x) dan dividend yield lebih tinggi (3.5% vs 1.1%). BBRI cocok untuk investor yang mengincar dividen, sedangkan BBCA cocok untuk pertumbuhan jangka panjang.",
  transcript:
    "Perbandingan saham BBCA dan BBRI. Kedua emiten mendapat kategori SEHAT. BBCA dengan skor 88 dan BBRI dengan skor 75. BBCA unggul dalam Return on Equity di 21.3 persen dibanding BBRI di 19.7 persen. Namun BBRI memiliki valuasi lebih murah dengan P/E Ratio 12.8 kali dibanding BBCA di 24.5 kali. Dividend yield BBRI juga lebih tinggi di 3.5 persen. Kesimpulan: BBCA untuk pertumbuhan, BBRI untuk dividen.",
  healthScore: null,
  comparison: MOCK_COMPARISON,
  historicalTrend: null,
  portfolio: null,
  query: "bandingkan BBCA dan BBRI",
};

const MOCK_COMPARISON_TLKM_ISAT: AnalysisResult = {
  summary:
    "Perbandingan fundamental TLKM vs ISAT menunjukkan TLKM lebih unggul dalam solvabilitas dan profitabilitas dengan skor kesehatan 82 vs 71. TLKM memiliki struktur neraca jauh lebih konservatif dengan DER 0.75x dibanding ISAT di 1.85x. Namun ISAT mencatatkan pertumbuhan pendapatan agresif pasca integrasi jaringan. Untuk stabilitas dividen dan ketahanan finansial, TLKM lebih direkomendasikan.",
  transcript:
    "Perbandingan fundamental emiten telekomunikasi TLKM dan ISAT. TLKM memperoleh skor kesehatan 82 dari 100 dengan status SEHAT. ISAT memperoleh skor 71 dari 100 dengan status SEHAT. TLKM unggul signifikan dalam rasio solvabilitas utang DER di 0.75 kali dibanding ISAT di 1.85 kali. Return on Equity TLKM berada di 18.2 persen dibanding ISAT di 14.5 persen. Kesimpulan: TLKM lebih kokoh secara fundamental untuk investasi jangka panjang.",
  healthScore: null,
  comparison: {
    symbols: ["TLKM", "ISAT"],
    names: {
      TLKM: "Telkom Indonesia Tbk",
      ISAT: "Indosat Ooredoo Hutchison Tbk",
    },
    healthScores: {
      TLKM: {
        symbol: "TLKM",
        name: "Telkom Indonesia Tbk",
        score: 82,
        category: "SEHAT",
        label: "[ SEHAT - Skor 82/100 ]",
      },
      ISAT: {
        symbol: "ISAT",
        name: "Indosat Ooredoo Hutchison Tbk",
        score: 71,
        category: "SEHAT",
        label: "[ SEHAT - Skor 71/100 ]",
      },
    },
    metrics: [
      { metric: "Skor Kesehatan", values: { TLKM: "82/100", ISAT: "71/100" } },
      { metric: "Status", values: { TLKM: "SEHAT", ISAT: "SEHAT" } },
      { metric: "DER (Debt to Equity)", values: { TLKM: "0.75x", ISAT: "1.85x" } },
      { metric: "ROE (Return on Equity)", values: { TLKM: "18.2%", ISAT: "14.5%" } },
      { metric: "ROA (Return on Assets)", values: { TLKM: "9.4%", ISAT: "5.1%" } },
      { metric: "DAR (Debt to Assets)", values: { TLKM: "0.42x", ISAT: "0.65x" } },
      { metric: "P/E Ratio", values: { TLKM: "14.2x", ISAT: "16.8x" } },
    ],
  },
  historicalTrend: null,
  portfolio: null,
  query: "bandingkan TLKM dan ISAT",
};

const MOCK_TREND_RESULT: AnalysisResult = {
  summary:
    "Tren kesehatan fundamental ADRO dalam 4 kuartal terakhir menunjukkan arah MEMBAIK secara konsisten dengan kenaikan skor 20 poin dari 75 menjadi 95. Rasio utang DER membaik ke 0.38 kali dan profitabilitas ROE naik stabil ke 10.9 persen. Tidak ada peringatan dini pelemahan fundamental.",
  transcript:
    "Analisis tren historis 4 kuartal saham ADRO — Adaro Energy Indonesia Tbk. Arah tren: MEMBAIK dengan kenaikan skor 20 poin. Skor kuartal Q1: 75, Q2: 82, Q3: 90, dan Q4 mencapai 95 dari 100 dengan status SANGAT SEHAT. Struktur permodalan sangat solid dengan DER rendah 0.38 kali dan ROE 10.9 persen.",
  healthScore: {
    symbol: "ADRO",
    name: "Adaro Energy Indonesia Tbk",
    score: 95,
    category: "SANGAT SEHAT",
    label: "[ SANGAT SEHAT - Skor 95/100 ]",
  },
  comparison: null,
  historicalTrend: {
    symbol: "ADRO",
    companyName: "Adaro Energy Indonesia Tbk",
    direction: "MEMBAIK",
    delta: 20,
    earlyWarning: null,
    summary:
      "Tren kesehatan fundamental ADRO dalam 4 kuartal terakhir menunjukkan arah MEMBAIK secara konsisten dengan kenaikan skor 20 poin dari 75 menjadi 95. Rasio utang DER membaik ke 0.38 kali dan profitabilitas ROE naik stabil ke 10.9 persen.",
    points: [
      { quarter: "Q1 2024", score: 75, status: "SEHAT", der: 0.55, roe: 0.085, pe: 6.2 },
      { quarter: "Q2 2024", score: 82, status: "SEHAT", der: 0.48, roe: 0.092, pe: 5.8 },
      { quarter: "Q3 2024", score: 90, status: "SANGAT SEHAT", der: 0.42, roe: 0.101, pe: 5.4 },
      { quarter: "Q4 2024", score: 95, status: "SANGAT SEHAT", der: 0.38, roe: 0.109, pe: 5.1 },
    ],
  },
  portfolio: null,
  query: "tren 4 kuartal ADRO",
};

const MOCK_PORTFOLIO_RESULT: AnalysisResult = {
  summary:
    "Simulasi portofolio modal 10 juta rupiah pada BBCA, TLKM, dan ASII menghasilkan skor terbobot 79 dari 100 dengan status SEHAT. Saham terlemah adalah ASII dengan skor 68 karena rasio utang yang lebih tinggi, sedangkan BBCA adalah jangkar terkuat dengan skor 88. Rebalancing disarankan untuk meningkatkan skor portofolio menjadi 82 poin.",
  transcript:
    "Simulasi portofolio investasi senilai 10 juta rupiah. Alokasi modal dibagi rata masing-masing Rp 3.333.333 pada BBCA, TLKM, dan ASII. Skor kesehatan portofolio gabungan: 79 dari 100, kategori SEHAT. Saham terlemah adalah ASII dengan skor 68 karena leverage utang meningkat. Saham terkuat adalah BBCA dengan skor 88. Saran rebalancing: naikkan alokasi BBCA menjadi 45 persen dan kurangi alokasi ASII menjadi 20 persen. Proyeksi skor portofolio setelah rebalancing akan naik menjadi 82 poin.",
  healthScore: null,
  comparison: null,
  historicalTrend: null,
  portfolio: {
    totalCapital: 10000000,
    weightedScore: 79,
    status: "SEHAT",
    allocations: [
      {
        symbol: "BBCA",
        name: "Bank Central Asia Tbk",
        weight: 33.33,
        nominal: 3333333,
        score: 88,
        status: "SANGAT SEHAT",
        suggested_weight: 45.0,
        suggested_nominal: 4500000,
      },
      {
        symbol: "TLKM",
        name: "Telkom Indonesia Tbk",
        weight: 33.33,
        nominal: 3333333,
        score: 82,
        status: "SEHAT",
        suggested_weight: 35.0,
        suggested_nominal: 3500000,
      },
      {
        symbol: "ASII",
        name: "Astra International Tbk",
        weight: 33.33,
        nominal: 3333333,
        score: 68,
        status: "WASPADA",
        suggested_weight: 20.0,
        suggested_nominal: 2000000,
      },
    ],
    weakestStock: {
      symbol: "ASII",
      reason: "Skor kesehatan 68 (WASPADA), rasio utang DER meningkat ke 1.8x dan marjin laba tertekan.",
    },
    strongestStock: {
      symbol: "BBCA",
      reason: "Skor kesehatan 88 (SANGAT SEHAT), ROE 21.3% dan solvabilitas modal sangat kokoh.",
    },
    rebalancingAdvice:
      "Disarankan melakukan rebalancing dengan menambah bobot pada saham jangkar BBCA menjadi 45% (Rp 4.500.000), menjaga TLKM di 35% (Rp 3.500.000), dan mengurangi bobot saham terlemah ASII menjadi 20% (Rp 2.000.000). Proyeksi skor kesehatan portofolio setelah penyesuaian akan meningkat dari 79 menjadi 82 poin.",
    projectedScoreAfterRebalance: 82,
  },
  query: "simulasi portofolio 10 juta",
};

const MOCK_TOP5_RESULT: AnalysisResult = {
  summary:
    "Berdasarkan skrining fundamental pasar saham BEI, top 5 saham paling sehat saat ini adalah BBCA (skor 88), ICBP (skor 85), TLKM (skor 82), KLBF (skor 80), dan ADRO (skor 78). Seluruh emiten memiliki neraca keuangan yang sangat kuat dengan DER di bawah batas aman serta profitabilitas ROE di atas rata-rata industri.",
  transcript:
    "Hasil skrining top 5 saham paling sehat di Bursa Efek Indonesia. Peringkat pertama adalah BBCA dengan skor 88 kategori SEHAT. Peringkat kedua ICBP dengan skor 85 kategori SEHAT. Peringkat ketiga TLKM dengan skor 82 kategori SEHAT. Peringkat keempat KLBF dengan skor 80 kategori SEHAT. Dan peringkat kelima ADRO dengan skor 78 kategori SEHAT. Seluruh emiten ini memiliki likuiditas tinggi dan risiko solvabilitas rendah.",
  healthScore: null,
  comparison: {
    symbols: ["BBCA", "ICBP", "TLKM", "KLBF", "ADRO"],
    names: {
      BBCA: "Bank Central Asia Tbk",
      ICBP: "Indofood CBP Sukses Makmur Tbk",
      TLKM: "Telkom Indonesia Tbk",
      KLBF: "Kalbe Farma Tbk",
      ADRO: "Adaro Energy Indonesia Tbk",
    },
    healthScores: {
      BBCA: { symbol: "BBCA", name: "Bank Central Asia Tbk", score: 88, category: "SANGAT SEHAT", label: "[ SANGAT SEHAT - Skor 88/100 ]" },
      ICBP: { symbol: "ICBP", name: "Indofood CBP Sukses Makmur Tbk", score: 85, category: "SANGAT SEHAT", label: "[ SANGAT SEHAT - Skor 85/100 ]" },
      TLKM: { symbol: "TLKM", name: "Telkom Indonesia Tbk", score: 82, category: "SEHAT", label: "[ SEHAT - Skor 82/100 ]" },
      KLBF: { symbol: "KLBF", name: "Kalbe Farma Tbk", score: 80, category: "SEHAT", label: "[ SEHAT - Skor 80/100 ]" },
      ADRO: { symbol: "ADRO", name: "Adaro Energy Indonesia Tbk", score: 78, category: "SEHAT", label: "[ SEHAT - Skor 78/100 ]" },
    },
    metrics: [
      { metric: "Skor Kesehatan", values: { BBCA: "88/100", ICBP: "85/100", TLKM: "82/100", KLBF: "80/100", ADRO: "78/100" } },
      { metric: "Status", values: { BBCA: "SANGAT SEHAT", ICBP: "SANGAT SEHAT", TLKM: "SEHAT", KLBF: "SEHAT", ADRO: "SEHAT" } },
      { metric: "DER (Debt to Equity)", values: { BBCA: "5.2x", ICBP: "0.82x", TLKM: "0.75x", KLBF: "0.22x", ADRO: "0.38x" } },
      { metric: "ROE (Return on Equity)", values: { BBCA: "21.3%", ICBP: "18.6%", TLKM: "18.2%", KLBF: "16.1%", ADRO: "10.9%" } },
    ],
  },
  historicalTrend: null,
  portfolio: null,
  query: "top 5 saham paling sehat",
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
  const q = query.toLowerCase().trim();

  // Mode Mock Instan: Sangat cepat & stabil untuk pengujian mikrofon
  if (isMockModeActive()) {
    await delay(350);

    // 1. Query Tren Historis (ADRO / kuartal / tren)
    if (q.includes("tren") || q.includes("kuartal") || q.includes("quarter") || q.includes("adro")) {
      return { ...MOCK_TREND_RESULT, query };
    }

    // 2. Query Portofolio (portofolio / 10 juta / simulasi / rebalance)
    if (q.includes("portofolio") || q.includes("juta") || q.includes("simulasi") || q.includes("rebalance")) {
      return { ...MOCK_PORTFOLIO_RESULT, query };
    }

    // 3. Query Top 5 / Rekomendasi / Screener
    if (q.includes("top") || q.includes("bagus") || q.includes("terbaik") || q.includes("sehat") || q.includes("rekomendasi")) {
      return { ...MOCK_TOP5_RESULT, query };
    }

    // 4. Query Perbandingan (TLKM vs ISAT atau umum)
    if (q.includes("tlkm") && q.includes("isat")) {
      return { ...MOCK_COMPARISON_TLKM_ISAT, query };
    }
    if (q.includes("bandingkan") || q.includes("vs") || q.includes("versus") || q.includes("perbandingan")) {
      return { ...MOCK_COMPARISON_RESULT, query };
    }

    // 5. Query Saham Tunggal (BBCA atau lainnya)
    return { ...MOCK_SINGLE_RESULT, query };
  }

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
