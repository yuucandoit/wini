"""Narrative guardrail: verifikasi angka pada narasi LLM terhadap hasil hitung deterministik.

Klaim yang DAPAT dipertanggungjawabkan:
- Skor dan rasio dihitung deterministik oleh Python (bukan LLM).
- Setiap angka yang muncul dalam narasi LLM dicocokkan dengan himpunan angka yang
  benar-benar ada pada hasil hitung. Jika ada angka yang tidak dikenali, narasi
  DITOLAK dan diganti narasi deterministik yang disusun dari data terverifikasi.

Batasan yang jujur: guardrail ini memeriksa konsistensi ANGKA. Ia tidak dapat
menjamin kebenaran penilaian/opini kualitatif dalam narasi (mis. kata "prospek cerah").
"""

from __future__ import annotations

import re
from typing import Any

# Angka kecil (hitungan/urutan, mis. "2 kuartal", "top 5") dan 100 (skala skor) selalu diizinkan.
_ALWAYS_ALLOWED = {float(i) for i in range(0, 11)} | {100.0}

_NUM_RE = re.compile(r"(?<![\w.])-?\d{1,3}(?:\.\d{3})+(?:,\d+)?|(?<![\w.])-?\d+(?:[.,]\d+)?")


def _parse_number(token: str) -> float | None:
    t = token.strip()
    # Format Indonesia: 3.333.333 atau 1.234,56
    if re.fullmatch(r"-?\d{1,3}(?:\.\d{3})+(?:,\d+)?", t):
        t = t.replace(".", "").replace(",", ".")
    else:
        t = t.replace(",", ".")
    try:
        return float(t)
    except ValueError:
        return None


def _collect_numbers(obj: Any, out: set[float]) -> None:
    if isinstance(obj, bool):
        return
    if isinstance(obj, (int, float)):
        v = float(obj)
        if v == v:  # bukan NaN
            out.add(v)
            out.add(v * 100.0)       # rasio -> persen
            out.add(v / 100.0)       # persen -> rasio
            out.add(abs(v))
            for nd in (0, 1, 2):
                out.add(round(v, nd))
                out.add(round(v * 100.0, nd))
        return
    if isinstance(obj, dict):
        for v in obj.values():
            _collect_numbers(v, out)
    elif isinstance(obj, (list, tuple)):
        for v in obj:
            _collect_numbers(v, out)
    elif isinstance(obj, str):
        for tok in _NUM_RE.findall(obj):
            n = _parse_number(tok)
            if n is not None:
                _collect_numbers(n, out)


def _is_close(x: float, allowed: set[float]) -> bool:
    for a in allowed:
        if abs(x - a) <= max(0.06, abs(a) * 0.006):
            return True
    return False


def verify_narrative(narrative: str, ground_truth: dict[str, Any]) -> dict[str, Any]:
    """Cek apakah semua angka dalam `narrative` ada di `ground_truth`.

    Returns:
        {"passed": bool, "checked": int, "unverified": [str, ...]}
    """
    allowed: set[float] = set(_ALWAYS_ALLOWED)
    _collect_numbers(ground_truth, allowed)

    unverified: list[str] = []
    checked = 0
    for tok in _NUM_RE.findall(narrative or ""):
        n = _parse_number(tok)
        if n is None:
            continue
        checked += 1
        if not _is_close(n, allowed):
            unverified.append(tok)

    return {"passed": not unverified, "checked": checked, "unverified": unverified}


def build_deterministic_narrative(
    health_scores: dict[str, dict[str, Any]],
    historical_trend: dict[str, Any] | None = None,
    portfolio: dict[str, Any] | None = None,
) -> str:
    """Narasi pengganti yang seluruhnya disusun dari data terverifikasi (tanpa LLM)."""
    parts: list[str] = []
    for sym, d in health_scores.items():
        if d.get("metrics_coverage", 0) <= 0:
            parts.append(f"Data fundamental {sym} tidak tersedia, sehingga skor tidak dapat dihitung.")
            continue
        parts.append(
            f"{sym} memperoleh skor kesehatan {d['score']} dari 100 dengan status {d['status']}."
        )
        for note in d.get("notes", [])[:2]:
            parts.append(note)
    if historical_trend and historical_trend.get("summary"):
        parts.append(historical_trend["summary"])
    if portfolio and portfolio.get("rebalancing_advice"):
        parts.append(f"Pertimbangan penyeimbangan portofolio: {portfolio['rebalancing_advice']}")
    parts.append("Ini adalah gambaran edukatif dari data historis, bukan nasihat investasi.")
    return " ".join(parts)
