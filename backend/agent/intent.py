"""LLM-based intent interpretation of the raw speech transcript.

The transcript (e.g. from the browser speech recognizer / Whisper) is handed to
the LLM, which extracts what the user actually asked for: tickers, how many
stocks, sector, and the kind of request. No keyword tables are involved here;
callers fall back to regex heuristics only if the LLM is unreachable.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

import httpx

from backend.config import get_settings

logger = logging.getLogger(__name__)

INTENT_TIMEOUT = 20.0
VALID_INTENTS = {"SINGLE", "COMPARISON", "SCREENER", "TREND", "PORTFOLIO", "GLOSSARY", "UNCLEAR"}

INTENT_PROMPT = (
    "Kamu adalah penafsir perintah untuk asisten analisis saham BEI (Indonesia). "
    "Input adalah hasil transkripsi suara pengguna, bisa salah dengar atau tidak baku. "
    "Pahami MAKSUD pengguna apa adanya, jangan menebak default.\n"
    "Balas HANYA satu objek JSON tanpa teks lain dengan kunci:\n"
    '{"intent": "SINGLE|COMPARISON|SCREENER|TREND|PORTFOLIO|GLOSSARY|UNCLEAR",'
    ' "tickers": [kode saham BEI 4 huruf kapital yang disebut/dimaksud, kosong jika tidak ada],'
    ' "limit": jumlah saham yang diminta pengguna sebagai angka (null jika tidak disebut),'
    ' "sector": "perbankan|energi|pertambangan|teknologi|telekomunikasi|konsumer|kesehatan|properti|infrastruktur|industri" atau null,'
    ' "capital": nominal modal rupiah sebagai angka atau null}\n'
    "Aturan: SCREENER = pengguna minta dicarikan/direkomendasikan beberapa saham tanpa menyebut emiten tertentu. "
    "Pakai jumlah persis yang diminta (top 3 -> 3, 'empat saham' -> 4). "
    "Ubah nama perusahaan ke kode sahamnya (mis. Telkom -> TLKM). "
    "Jika tidak ada emiten, sektor, maupun permintaan saham yang jelas, intent = UNCLEAR."
)


def _extract_json(text: str) -> dict[str, Any] | None:
    text = re.sub(r"<think>.*?</think>", "", text or "", flags=re.DOTALL)
    m = re.search(r"\{.*\}", text, flags=re.DOTALL)
    if not m:
        return None
    try:
        data = json.loads(m.group(0))
    except json.JSONDecodeError:
        return None
    return data if isinstance(data, dict) else None


def _normalize(data: dict[str, Any]) -> dict[str, Any] | None:
    intent = str(data.get("intent", "")).upper()
    if intent not in VALID_INTENTS:
        return None

    tickers: list[str] = []
    for t in data.get("tickers") or []:
        sym = re.sub(r"[^A-Za-z]", "", str(t)).upper()
        if len(sym) == 4 and sym not in tickers:
            tickers.append(sym)

    limit = data.get("limit")
    try:
        limit = max(1, min(int(limit), 10)) if limit is not None else None
    except (TypeError, ValueError):
        limit = None

    sector = data.get("sector")
    sector = str(sector).lower() if sector else None

    capital = data.get("capital")
    try:
        capital = float(capital) if capital else None
    except (TypeError, ValueError):
        capital = None

    return {"intent": intent, "tickers": tickers, "limit": limit, "sector": sector, "capital": capital}


async def interpret_query(text: str) -> dict[str, Any] | None:
    """Ask the LLM what the user meant. Returns None if the LLM is unavailable."""
    settings = get_settings()
    if not settings.OPENROUTER_API_KEY:
        return None

    headers = {
        "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "X-Title": "WINI AI Intent",
    }
    url = f"{settings.OPENROUTER_BASE_URL}/chat/completions"
    models = [settings.OPENROUTER_MODEL]
    for fb in ("nvidia/nemotron-3.5-lightning:free", "openrouter/free"):
        if fb not in models:
            models.append(fb)

    for model in models:
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": INTENT_PROMPT},
                {"role": "user", "content": text},
            ],
            "max_tokens": 300,
            "temperature": 0,
        }
        try:
            async with httpx.AsyncClient(timeout=INTENT_TIMEOUT) as client:
                resp = await client.post(url, json=payload, headers=headers)
            if resp.status_code != 200:
                continue
            choices = resp.json().get("choices", [])
            if not choices:
                continue
            msg = choices[0].get("message", {}) or {}
            parsed = _extract_json(msg.get("content") or msg.get("reasoning") or "")
            result = _normalize(parsed) if parsed else None
            if result:
                logger.info(f"LLM intent for '{text[:60]}': {result}")
                return result
        except Exception as e:  # noqa: BLE001
            logger.warning(f"Intent model {model} failed: {e}")
    return None
