"""Application configuration loaded from environment variables."""

from __future__ import annotations

from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # API Keys
    SECTORS_API_KEY: str = ""
    OPENROUTER_API_KEY: str = ""

    # Sectors API
    SECTORS_BASE_URL: str = "https://api.sectors.app"

    # OpenRouter
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"
    OPENROUTER_MODEL: str = "openrouter/free"

    # Cache TTLs (seconds)
    FINANCIAL_CACHE_TTL: int = 3600   # 1 hour
    NEWS_CACHE_TTL: int = 600         # 10 minutes

    # Session Memory
    SESSION_MAX_TURNS: int = 5
    SESSION_EXPIRY_SECONDS: int = 1800  # 30 minutes

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache()
def get_settings() -> Settings:
    return Settings()
