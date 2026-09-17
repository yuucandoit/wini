"""Deterministic Scoring Engine for WINI AI.

Evaluates financial health deterministically using quantitative metrics
without any LLM dependency. Supports graceful degradation when metrics
are missing and produces screen-reader-friendly status indicators.
"""

from __future__ import annotations

from dataclasses import dataclass, field
import logging
from typing import Any

logger = logging.getLogger(__name__)

# Base metric weights (sum = 100)
METRIC_WEIGHTS = {
    "der_mrq": 30.0,
    "roe_ttm": 25.0,
    "roa_ttm": 20.0,
    "dar_mrq": 15.0,
    "pe_ttm": 10.0,
}


@dataclass
class HealthScoreResult:
    """Result of deterministic health scoring."""
    score: int
    status: str
    metrics_evaluated: dict[str, float]
    metrics_coverage: float
    breakdown: dict[str, dict[str, Any]] = field(default_factory=dict)


def _normalize_percentage(val: float) -> float:
    """Normalize percentage or decimal metric to standard decimal fraction (e.g. 15% -> 0.15)."""
    # If API returns 14.5 for 14.5%, convert to 0.145
    if abs(val) > 1.0:
        return val / 100.0
    return val


def _score_der(val: float) -> tuple[float, str]:
    """Score Debt to Equity Ratio (max weight: 30).
    Lower is generally safer.
    """
    if val <= 1.0:
        return 30.0, "Sangat baik: Liabilitas seimbang atau lebih kecil dari ekuitas (DER <= 1.0)"
    elif val <= 1.5:
        return 22.0, "Moderat: Struktur utang wajar dan terkendali (DER 1.0 - 1.5)"
    elif val <= 2.0:
        return 15.0, "Cukup tinggi: Perlu pemantauan beban utang (DER 1.5 - 2.0)"
    else:
        return 5.0, "Tinggi: Leverage signifikan, risiko solvabilitas (DER > 2.0)"


def _score_roe(val: float) -> tuple[float, str]:
    """Score Return on Equity (max weight: 25).
    Higher is better.
    """
    ratio = _normalize_percentage(val)
    if ratio >= 0.15:
        return 25.0, "Sangat menguntungkan: Kemampuan menghasilkan laba atas ekuitas tinggi (ROE >= 15%)"
    elif ratio >= 0.10:
        return 20.0, "Baik: Profitabilitas solid di atas rata-rata (ROE 10% - 15%)"
    elif ratio >= 0.05:
        return 12.0, "Cukup: Profitabilitas moderat (ROE 5% - 10%)"
    else:
        return 5.0, "Rendah: Pengembalian ekuitas di bawah standar (ROE < 5%)"


def _score_roa(val: float) -> tuple[float, str]:
    """Score Return on Assets (max weight: 20).
    Higher is better.
    """
    ratio = _normalize_percentage(val)
    if ratio >= 0.10:
        return 20.0, "Sangat efisien: Pemanfaatan aset prima (ROA >= 10%)"
    elif ratio >= 0.05:
        return 15.0, "Baik: Efisiensi aset terjaga (ROA 5% - 10%)"
    elif ratio >= 0.02:
        return 10.0, "Cukup: Produktivitas aset standar (ROA 2% - 5%)"
    else:
        return 3.0, "Rendah: Utilisasi aset kurang optimal (ROA < 2%)"


def _score_dar(val: float) -> tuple[float, str]:
    """Score Debt to Asset Ratio (max weight: 15).
    Lower is generally safer.
    """
    ratio = _normalize_percentage(val)
    if ratio <= 0.40:
        return 15.0, "Sangat konservatif: Utang hanya porsi kecil dari total aset (DAR <= 40%)"
    elif ratio <= 0.60:
        return 10.0, "Wajar: Struktur permodalan sehat (DAR 40% - 60%)"
    elif ratio <= 0.80:
        return 5.0, "Waspada: Mayoritas aset didanai kewajiban (DAR 60% - 80%)"
    else:
        return 2.0, "Berisiko: Aset sangat didominasi utang (DAR > 80%)"


def _score_pe(val: float) -> tuple[float, str]:
    """Score Price-to-Earnings Ratio (max weight: 10).
    Moderate positive PE is ideal.
    """
    if 5.0 <= val <= 15.0:
        return 10.0, "Valuasi atraktif: PE rasional dan berpotensi undervalued (PE 5 - 15)"
    elif 15.0 < val <= 25.0:
        return 7.0, "Valuasi wajar: PE dalam rentang pasar normal (PE 15 - 25)"
    elif (0.0 < val < 5.0) or (25.0 < val <= 40.0):
        return 4.0, "Valuasi ekstrem: Sangat murah atau memiliki ekspektasi pertumbuhan tinggi (PE < 5 atau 25 - 40)"
    else:
        return 1.0, "Perhatian: Perusahaan merugi (PE negatif) atau valuasi sangat tinggi (PE > 40)"


def _score_dividend_yield(val: float) -> tuple[float, str]:
    """Score dividend yield (max weight: bonus 10 pts on top of base score).
    Higher yield with consistency is better. val is the TTM yield as a fraction.
    """
    # val may come as percent (e.g. 4.5) or fraction (0.045) — normalize
    ratio = val / 100.0 if abs(val) > 1.0 else val
    if ratio >= 0.05:
        return 10.0, "Dividen tinggi dan konsisten (yield >= 5%)"
    elif ratio >= 0.03:
        return 7.0, "Dividen menarik dan stabil (yield 3% - 5%)"
    elif ratio >= 0.01:
        return 4.0, "Dividen moderat (yield 1% - 3%)"
    else:
        return 0.0, "Dividen sangat kecil atau tidak membayar dividen (yield < 1%)"


def _get_status(score: int) -> str:
    """Map numeric score (0-100) to clear screen-reader-friendly status.

    Tiers:
        85-100 → SANGAT SEHAT   (fundamental prima, semua metrik unggul)
        70-84  → SEHAT           (fundamental kuat, minor caveats)
        50-69  → WASPADA         (perlu perhatian, ada metrik lemah)
        0-49   → BERISIKO TINGGI (fundamental rapuh, risiko signifikan)
    """
    if score >= 85:
        return "SANGAT SEHAT"
    elif score >= 70:
        return "SEHAT"
    elif score >= 50:
        return "WASPADA"
    return "BERISIKO TINGGI"


def calculate_health_score(metrics: dict[str, Any]) -> HealthScoreResult:
    """Calculate deterministic health score with graceful degradation.

    Args:
        metrics: Dictionary containing financial metric keys and numeric values.

    Returns:
        HealthScoreResult containing final scaled score, status, and breakdown.
    """
    scorers = {
        "der_mrq": _score_der,
        "roe_ttm": _score_roe,
        "roa_ttm": _score_roa,
        "dar_mrq": _score_dar,
        "pe_ttm": _score_pe,
    }

    evaluated_metrics: dict[str, float] = {}
    breakdown: dict[str, dict[str, Any]] = {}

    total_achieved = 0.0
    total_possible_weight = 0.0

    for metric_name, scorer_fn in scorers.items():
        raw_val = metrics.get(metric_name)
        max_weight = METRIC_WEIGHTS[metric_name]

        if raw_val is not None:
            try:
                numeric_val = float(raw_val)
                score_pts, description = scorer_fn(numeric_val)
                evaluated_metrics[metric_name] = numeric_val
                total_achieved += score_pts
                total_possible_weight += max_weight

                breakdown[metric_name] = {
                    "value": numeric_val,
                    "score": round(score_pts, 1),
                    "max_weight": max_weight,
                    "description": description,
                }
            except (ValueError, TypeError):
                breakdown[metric_name] = {
                    "value": None,
                    "score": 0.0,
                    "max_weight": max_weight,
                    "description": "Nilai metrik tidak valid",
                }
        else:
            breakdown[metric_name] = {
                "value": None,
                "score": 0.0,
                "max_weight": max_weight,
                "description": "Data metrik tidak tersedia",
            }

    total_metrics_count = len(scorers)
    available_metrics_count = len(evaluated_metrics)
    coverage = round(available_metrics_count / total_metrics_count, 2) if total_metrics_count > 0 else 0.0

    # Graceful degradation: Scale achieved points proportionally based on available weights
    if total_possible_weight > 0:
        final_score = int(round((total_achieved / total_possible_weight) * 100.0))
    else:
        final_score = 0

    final_score = max(0, min(100, final_score))

    # Dividend yield bonus (up to +10 pts, capped at 100)
    yield_ttm_val = metrics.get("yield_ttm")
    if yield_ttm_val is not None:
        try:
            dividend_bonus, dividend_desc = _score_dividend_yield(float(yield_ttm_val))
            final_score = min(100, final_score + int(round(dividend_bonus)))
            breakdown["dividend_yield_bonus"] = {
                "value": float(yield_ttm_val),
                "score": round(dividend_bonus, 1),
                "max_weight": 10.0,
                "description": dividend_desc,
            }
        except (ValueError, TypeError):
            breakdown["dividend_yield_bonus"] = {
                "value": None,
                "score": 0.0,
                "max_weight": 10.0,
                "description": "Nilai yield tidak valid",
            }
    else:
        breakdown["dividend_yield_bonus"] = {
            "value": None,
            "score": 0.0,
            "max_weight": 10.0,
            "description": "Data dividen tidak tersedia",
        }

    status = _get_status(final_score)

    return HealthScoreResult(
        score=final_score,
        status=status,
        metrics_evaluated=evaluated_metrics,
        metrics_coverage=coverage,
        breakdown=breakdown,
    )


def calculate_comparative_score(ticker_scores: dict[str, HealthScoreResult]) -> dict[str, Any]:
    """Calculate comparative rankings and summary across multiple tickers.

    Args:
        ticker_scores: Dictionary of ticker symbol to HealthScoreResult.

    Returns:
        Comparative summary dictionary.
    """
    if not ticker_scores:
        return {}

    ranked = sorted(ticker_scores.items(), key=lambda item: item[1].score, reverse=True)
    avg_score = round(sum(item[1].score for item in ranked) / len(ranked), 1)

    best_ticker, best_result = ranked[0]
    lowest_ticker, lowest_result = ranked[-1]

    return {
        "average_score": avg_score,
        "leader": {
            "symbol": best_ticker,
            "score": best_result.score,
            "status": best_result.status,
        },
        "laggard": {
            "symbol": lowest_ticker,
            "score": lowest_result.score,
            "status": lowest_result.status,
        },
        "ranking": [
            {
                "rank": idx + 1,
                "symbol": sym,
                "score": res.score,
                "status": res.status,
            }
            for idx, (sym, res) in enumerate(ranked)
        ],
    }


def calculate_quarterly_trend(
    symbol: str,
    company_name: str,
    quarterly_data: list[dict[str, Any]],
) -> dict[str, Any]:
    """Calculate financial health trend across quarters (typically 4 quarters).

    Args:
        symbol: Ticker symbol (e.g. 'ADRO')
        company_name: Name of the company
        quarterly_data: List of dicts with 'quarter' and metric ratios.

    Returns:
        Historical trend summary with quarterly points, direction, delta, early_warning, and summary.
    """
    clean_sym = symbol.strip().upper().replace(".JK", "")
    points: list[dict[str, Any]] = []

    for item in quarterly_data:
        quarter_label = item.get("quarter") or item.get("period") or "Q"
        metrics = {
            "der_mrq": item.get("der_mrq"),
            "roe_ttm": item.get("roe_ttm"),
            "roa_ttm": item.get("roa_ttm"),
            "dar_mrq": item.get("dar_mrq"),
            "pe_ttm": item.get("pe_ttm"),
            "yield_ttm": item.get("yield_ttm"),
        }
        res = calculate_health_score(metrics)
        points.append({
            "quarter": quarter_label,
            "score": res.score,
            "status": res.status,
            "der": item.get("der_mrq"),
            "roe": item.get("roe_ttm"),
            "pe": item.get("pe_ttm"),
        })

    if not points:
        return {
            "symbol": clean_sym,
            "company_name": company_name,
            "points": [],
            "direction": "STAGNAN",
            "delta": 0,
            "early_warning": None,
            "summary": f"Data kuartalan untuk {clean_sym} tidak tersedia.",
        }

    first_score = points[0]["score"]
    latest_score = points[-1]["score"]
    delta = latest_score - first_score

    if delta >= 5:
        direction = "MEMBAIK"
    elif delta <= -5:
        direction = "MEMBURUK"
    else:
        direction = "STAGNAN"

    # Early warning detection
    early_warning = None
    if direction == "MEMBURUK":
        early_warning = (
            f"⚠️ Peringatan Dini: Terdeteksi pelemahan fundamental pada {points[-1]['quarter']}. "
            f"Skor kesehatan menurun sebesar {abs(delta)} poin dari {first_score} ke {latest_score}. "
            f"Waspadai potensi koreksi harga jika kinerja operasional tidak membaik."
        )
    elif any(
        points[i]["score"] - points[i + 1]["score"] >= 8
        for i in range(len(points) - 1)
    ):
        early_warning = (
            f"⚠️ Peringatan Volatilitas: Terdapat penurunan skor tajam antarkuartal. "
            f"Perhatikan stabilitas laba bersih dan kewajiban jangka pendek emiten."
        )

    summary_text = (
        f"Tren kesehatan fundamental {clean_sym} ({company_name}) dalam {len(points)} kuartal terakhir "
        f"berstatus {direction}. Skor bergerak dari {first_score} ({points[0]['status']}) "
        f"menjadi {latest_score} ({points[-1]['status']}) dengan perubahan {delta:+d} poin."
    )
    if early_warning:
        summary_text += f" {early_warning}"

    return {
        "symbol": clean_sym,
        "company_name": company_name,
        "points": points,
        "direction": direction,
        "delta": delta,
        "early_warning": early_warning,
        "summary": summary_text,
    }


def simulate_portfolio(
    ticker_scores: dict[str, HealthScoreResult],
    company_names: dict[str, str],
    total_capital: float = 10_000_000.0,
    custom_weights: dict[str, float] | None = None,
) -> dict[str, Any]:
    """Simulate stock portfolio allocation with weighted scoring and rebalancing.

    Args:
        ticker_scores: Dict of ticker symbol to HealthScoreResult.
        company_names: Dict of ticker symbol to display name.
        total_capital: Total capital in IDR (e.g. 10.000.000).
        custom_weights: Optional custom weight mapping (must sum to ~1.0).

    Returns:
        Structured portfolio simulation with weighted score, weakest/strongest stocks, and rebalancing advice.
    """
    tickers = list(ticker_scores.keys())
    n = len(tickers)
    if n == 0:
        return {}

    # Determine weights
    if custom_weights and len(custom_weights) == n:
        weights = custom_weights
    else:
        # Default equal weighting (sama rata)
        equal_w = 1.0 / n
        weights = {sym: equal_w for sym in tickers}

    # Calculate weighted score
    weighted_score_float = sum(weights[sym] * ticker_scores[sym].score for sym in tickers)
    weighted_score = int(round(weighted_score_float))
    portfolio_status = _get_status(weighted_score)

    # Identify weakest (laggard) and strongest (anchor)
    sorted_tickers = sorted(tickers, key=lambda s: ticker_scores[s].score)
    weakest_sym = sorted_tickers[0]
    strongest_sym = sorted_tickers[-1]
    weakest_score = ticker_scores[weakest_sym].score
    strongest_score = ticker_scores[strongest_sym].score

    # Determine rebalancing strategy
    # If weakest stock is below 75 or significantly lower than strongest:
    need_rebalance = (strongest_score - weakest_score >= 12) or (weakest_score < 70)

    suggested_weights: dict[str, float] = {}
    if need_rebalance and n > 1:
        # Reduce weakest weight, boost strongest weight
        weakest_cut = min(weights[weakest_sym] * 0.5, 0.15)
        remaining_boost = weakest_cut / (n - 1)
        for sym in tickers:
            if sym == weakest_sym:
                suggested_weights[sym] = max(0.10, round(weights[sym] - weakest_cut, 3))
            elif sym == strongest_sym:
                suggested_weights[sym] = round(weights[sym] + weakest_cut, 3)
            else:
                suggested_weights[sym] = round(weights[sym], 3)

        # Normalize to ensure sum == 1.0
        tot = sum(suggested_weights.values())
        suggested_weights = {k: round(v / tot, 4) for k, v in suggested_weights.items()}
    else:
        suggested_weights = {sym: round(weights[sym], 4) for sym in tickers}

    projected_score_float = sum(suggested_weights[sym] * ticker_scores[sym].score for sym in tickers)
    projected_score = int(round(projected_score_float))

    allocations: list[dict[str, Any]] = []
    for sym in tickers:
        w = weights[sym]
        sw = suggested_weights[sym]
        allocations.append({
            "symbol": sym,
            "name": company_names.get(sym, sym),
            "weight": round(w, 4),
            "nominal": int(round(total_capital * w)),
            "score": ticker_scores[sym].score,
            "status": ticker_scores[sym].status,
            "suggested_weight": round(sw, 4),
            "suggested_nominal": int(round(total_capital * sw)),
        })

    # Weakest reason text
    weakest_metrics = ticker_scores[weakest_sym].metrics_evaluated
    der_val = weakest_metrics.get("der_mrq")
    roe_val = weakest_metrics.get("roe_ttm")
    weak_reason = f"Skor kesehatan terendah ({weakest_score}/100, {ticker_scores[weakest_sym].status})"
    if der_val and der_val > 2.0:
        weak_reason += f" dipicu rasio utang DER tinggi ({der_val:.2f}x)"
    elif roe_val and roe_val < 0.08:
        weak_reason += f" dipicu profitabilitas ROE rendah ({roe_val * 100:.1f}%)"

    strong_reason = f"Skor kesehatan tertinggi ({strongest_score}/100, {ticker_scores[strongest_sym].status}) sebagai jangkar stabilitas portofolio"

    if need_rebalance and n > 1:
        rebalancing_advice = (
            f"Rekomendasi Rebalancing: Kurangi porsi {weakest_sym} dari {int(round(weights[weakest_sym]*100))}% "
            f"menjadi {int(round(suggested_weights[weakest_sym]*100))}% (Rp {int(round(total_capital * suggested_weights[weakest_sym])):,.0f}) "
            f"karena profil risikonya lebih tinggi. Alihkan dana ke {strongest_sym} menjadi {int(round(suggested_weights[strongest_sym]*100))}% "
            f"(Rp {int(round(total_capital * suggested_weights[strongest_sym])):,.0f}). "
            f"Langkah ini diproyeksikan menaikkan skor portofolio dari {weighted_score} ke {projected_score} poin."
        )
    else:
        rebalancing_advice = (
            "Portofolio saat ini sudah seimbang dan memiliki profil fundamental yang sehat. "
            "Pertahankan alokasi sama rata dan pantau perkembangan laporan keuangan kuartalan berikutnya."
        )

    return {
        "total_capital": total_capital,
        "weighted_score": weighted_score,
        "status": portfolio_status,
        "allocations": allocations,
        "weakest_stock": {
            "symbol": weakest_sym,
            "reason": weak_reason,
        },
        "strongest_stock": {
            "symbol": strongest_sym,
            "reason": strong_reason,
        },
        "rebalancing_advice": rebalancing_advice,
        "projected_score_after_rebalance": projected_score,
    }

