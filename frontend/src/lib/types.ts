// ============================================================
// WINI AI Frontend — Type Definitions
// ============================================================

/** Application state machine phases */
export type AppPhase =
  | "idle"        // Welcome banner visible, waiting for user activation
  | "welcome"     // TTS greeting playing + live caption
  | "listening"   // Mic active or text input focused
  | "processing"  // Awaiting backend response
  | "results";    // Analysis results rendered

/** Health score severity categories */
export type HealthCategory = "SANGAT SEHAT" | "SEHAT" | "WASPADA" | "BAHAYA" | "BERISIKO TINGGI";

/** A single emiten's health score */
export interface HealthScore {
  /** Stock ticker symbol, e.g. "BBCA" */
  symbol: string;
  /** Company name */
  name: string;
  /** Numeric score 0–100 */
  score: number;
  /** Derived category */
  category: HealthCategory;
  /** Human-readable label, e.g. "[ SEHAT - Skor 85/100 ]" */
  label: string;
}

/** A single metric row in the comparison table */
export interface ComparisonMetric {
  /** Metric display name, e.g. "Revenue", "P/E Ratio" */
  metric: string;
  /** Values keyed by stock symbol */
  values: Record<string, string>;
}

/** Full comparison result for multiple emitens */
export interface ComparisonResult {
  /** Column headers (stock symbols) */
  symbols: string[];
  /** Company names keyed by symbol */
  names: Record<string, string>;
  /** Health scores keyed by symbol */
  healthScores: Record<string, HealthScore>;
  /** Rows of comparative metrics */
  metrics: ComparisonMetric[];
}

/** Single quarter data point in historical trend */
export interface QuarterlyPoint {
  quarter: string;
  score: number;
  status: HealthCategory;
  der?: number | null;
  roe?: number | null;
  pe?: number | null;
}

/** Historical trend analysis data */
export interface HistoricalTrend {
  symbol: string;
  companyName: string;
  points: QuarterlyPoint[];
  direction: "MEMBAIK" | "MEMBURUK" | "STAGNAN";
  delta: number;
  earlyWarning: string | null;
  summary: string;
}

/** Single stock allocation in portfolio simulation */
export interface PortfolioAllocation {
  symbol: string;
  name: string;
  weight: number;
  nominal: number;
  score: number;
  status: HealthCategory;
  suggested_weight?: number;
  suggested_nominal?: number;
}

/** Portfolio simulation with rebalancing advice */
export interface PortfolioSimulation {
  totalCapital: number;
  weightedScore: number;
  status: HealthCategory;
  allocations: PortfolioAllocation[];
  weakestStock: { symbol: string; reason: string };
  strongestStock: { symbol: string; reason: string };
  rebalancingAdvice: string;
  projectedScoreAfterRebalance?: number;
}

/** Backend analysis response */
export interface AnalysisResult {
  /** Natural-language summary of the analysis */
  summary: string;
  /** Full transcript text for the live caption / subtitle box */
  transcript: string;
  /** Primary emiten health score (single-stock query) */
  healthScore: HealthScore | null;
  /** Side-by-side comparison data (multi-stock query) */
  comparison: ComparisonResult | null;
  /** Historical quarterly trend data (if trend query) */
  historicalTrend?: HistoricalTrend | null;
  /** Portfolio simulation data (if portfolio query) */
  portfolio?: PortfolioSimulation | null;
  /** Raw query that produced this result */
  query: string;
}

/** Reducer actions for the workspace state machine */
export type WorkspaceAction =
  | { type: "ACTIVATE" }                           // idle → welcome
  | { type: "GREETING_DONE" }                      // welcome → listening
  | { type: "SUBMIT_QUERY"; payload: string }      // listening → processing
  | { type: "RECEIVE_RESULT"; payload: AnalysisResult } // processing → results
  | { type: "RESET" }                              // any → idle
  | { type: "ERROR"; payload: string };            // any → listening (with error)

/** Full workspace state */
export interface WorkspaceState {
  phase: AppPhase;
  currentQuery: string;
  result: AnalysisResult | null;
  error: string | null;
  captionText: string;
}
