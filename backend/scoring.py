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


def _get_status(score: int) -> str:
    """Map numeric score (0-100) to clear screen-reader-friendly status."""
    if score >= 85:
        return "SEHAT"
    elif score >= 60:
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
