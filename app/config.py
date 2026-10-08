import os
from pathlib import Path
from typing import Any
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central configuration for Say It Right."""

    # LLM Settings
    llm_provider: str = "fake"  # fake | anthropic | openai | openai_compat | gemini | ollama
    llm_model: str = "default-model"
    llm_base_url: str | None = None
    llm_api_key: str | None = None
    llm_temperature: float = 0.2
    llm_max_tokens: int = 4096
    llm_fallback_models: str | list[str] = [
        "gemini-3.5-flash",
        "gemini-3.6-flash",
        "gemini-3.1-flash-lite",
    ]

    @field_validator("llm_fallback_models")
    @classmethod
    def parse_fallbacks(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, str):
            return [item.strip() for item in v.split(",") if item.strip()]
        return list(v)

    # Application Limits & Guardrails
    min_draft_chars: int = 15
    max_draft_chars: int = 3000
    rate_limit_per_min: int = 20

    # Prompt and Rubric paths
    prompt_dir: Path = Path("prompts")
    rubric_dir: Path = Path("rubrics")
    diagnose_prompt_file: str = "diagnose.v1.md"
    rewrite_prompt_file: str = "rewrite.v1.md"
    rubric_file: str = "professor_ask.v1.yaml"

    # Server settings
    host: str = "0.0.0.0"
    port: int = 8000
    environment: str = "production"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
