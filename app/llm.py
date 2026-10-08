import threading
from dataclasses import dataclass
from typing import Protocol
import json
import httpx
from app.config import Settings


@dataclass(frozen=True)
class LLMResponse:
    text: str
    provider: str
    model: str
    input_tokens: int | None = None
    output_tokens: int | None = None


class LLMClient(Protocol):
    def generate(
        self,
        *,
        system: str,
        user: str,
        max_tokens: int = 4096,
        temperature: float = 0.2,
    ) -> LLMResponse: ...


class FakeLLM:
    """Mock LLM returning deterministic, schema-valid JSON for testing, evals, and offline dev."""

    def __init__(self, cfg: Settings | None = None, model: str | None = None):
        self.provider = "fake"
        self.model = model or "fake-evaluator"

    def generate(
        self,
        *,
        system: str,
        user: str,
        max_tokens: int = 4096,
        temperature: float = 0.2,
    ) -> LLMResponse:
        if "CRITICAL HONESTY GUARD" in system or "rewrite" in system.lower() or "rewrite" in user.lower():
            mock_data = {
                "rewrite": (
                    "Dear Professor,\n\n"
                    "I am writing to respectfully request a 48-hour extension on the upcoming assignment. "
                    "I encountered an unforeseen setback and want to ensure my submission meets the course standards. "
                    "I have attached my current progress and can submit the completed work by Friday at 5:00 PM. "
                    "Thank you very much for your time and consideration.\n\n"
                    "Sincerely,\n[Your Name]"
                ),
                "changes": [
                    {
                        "from": "can I get extra time",
                        "to": "respectfully request a 48-hour extension",
                        "reason": "Clarifies the exact timeframe upfront and shows academic respect",
                        "principle": "Lead with the ask",
                    },
                    {
                        "from": "the deadline was unfair",
                        "to": "encountered an unforeseen setback",
                        "reason": "Eliminates defensive blame and demonstrates accountability",
                        "principle": "Own it",
                    },
                ],
                "takeaway": "State the ask and target submission date in your opening sentence.",
                "new_facts_introduced": [],
            }
            return LLMResponse(
                text=json.dumps(mock_data),
                provider=self.provider,
                model=self.model,
                input_tokens=150,
                output_tokens=220,
            )

        flag_list = []
        user_lower = user.lower()

        if "unfair" in user_lower:
            flag_list.append({
                "text": "unfair",
                "reason": "Blaming the deadline or syllabus reads as defensive and deflects personal responsibility.",
                "principle": "Own it",
                "nudge": "Describe the specific obstacle on your side instead of critiquing the course schedule.",
            })

        if "hey prof" in user_lower or "hey " in user_lower:
            phrase = "hey prof" if "hey prof" in user_lower else "hey"
            flag_list.append({
                "text": phrase,
                "reason": "Overly casual greeting can be perceived as lacking academic respect.",
                "principle": "Academic address",
                "nudge": "Use 'Dear Professor [Last Name],' or 'Hello Professor [Last Name],'.",
            })

        if not flag_list:
            flag_list.append({
                "text": user.splitlines()[-1][:30].strip() if user.splitlines() else "my situation",
                "reason": "Could state your specific proposed next steps more directly.",
                "principle": "Lead with the ask",
                "nudge": "Specify your proposed resolution clearly.",
            })

        mock_data = {
            "verdict": "A professor may read this as hurried and somewhat defensive.",
            "scores": {
                "clarity": {"value": 2, "target_min": 4, "target_max": 5},
                "accountability": {"value": 2, "target_min": 4, "target_max": 5},
                "warmth": {"value": 3, "target_min": 3, "target_max": 5},
                "formality": {"value": 2, "target_min": 3, "target_max": 4},
                "proportion": {"value": 3, "target_min": 3, "target_max": 4},
            },
            "flags": flag_list,
        }
        return LLMResponse(
            text=json.dumps(mock_data),
            provider=self.provider,
            model=self.model,
            input_tokens=220,
            output_tokens=180,
        )


class AnthropicClient:
    """Direct HTTPS client for Anthropic Claude API."""

    def __init__(self, cfg: Settings, model: str | None = None):
        self.provider = "anthropic"
        self.model = model or cfg.llm_model or "claude-3-5-sonnet-20241022"
        self.api_key = cfg.llm_api_key or ""
        self.timeout = 45.0
        self._client = httpx.Client(timeout=self.timeout)

    def generate(
        self,
        *,
        system: str,
        user: str,
        max_tokens: int = 4096,
        temperature: float = 0.2,
    ) -> LLMResponse:
        url = "https://api.anthropic.com/v1/messages"
        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
        payload = {
            "model": self.model,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "system": system,
            "messages": [{"role": "user", "content": user}],
        }
        resp = self._client.post(url, headers=headers, json=payload)
        resp.raise_for_status()
        data = resp.json()

        text = "".join(b["text"] for b in data.get("content", []) if b.get("type") == "text")
        usage = data.get("usage", {})
        return LLMResponse(
            text=text,
            provider=self.provider,
            model=self.model,
            input_tokens=usage.get("input_tokens"),
            output_tokens=usage.get("output_tokens"),
        )


class OpenAIClient:
    """Direct HTTPS client for OpenAI and OpenAI-compatible endpoints (Groq, Together, Ollama, vLLM)."""

    def __init__(self, cfg: Settings, model: str | None = None):
        self.provider = cfg.llm_provider
        self.model = model or cfg.llm_model or "gpt-4o-mini"
        self.api_key = cfg.llm_api_key or "sk-dummy"
        base = (cfg.llm_base_url or "https://api.openai.com/v1").rstrip("/")
        self.url = f"{base}/chat/completions"
        self.timeout = 45.0
        self._client = httpx.Client(timeout=self.timeout)

    def generate(
        self,
        *,
        system: str,
        user: str,
        max_tokens: int = 4096,
        temperature: float = 0.2,
    ) -> LLMResponse:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        }
        resp = self._client.post(self.url, headers=headers, json=payload)
        resp.raise_for_status()
        data = resp.json()

        choice = data["choices"][0]["message"]["content"]
        usage = data.get("usage", {})
        return LLMResponse(
            text=choice,
            provider=self.provider,
            model=self.model,
            input_tokens=usage.get("prompt_tokens"),
            output_tokens=usage.get("completion_tokens"),
        )


class GeminiClient:
    """Official Google GenAI SDK client for Google Gemini models with configurable fallback."""

    def __init__(self, cfg: Settings, model: str | None = None):
        from google import genai

        self.provider = "gemini"
        self.model = model or cfg.llm_model
        fallback_list = getattr(cfg, "llm_fallback_models", [])
        self.fallback_models = [m for m in fallback_list if m != self.model]
        self.client = genai.Client(api_key=cfg.llm_api_key)

    def generate(
        self,
        *,
        system: str,
        user: str,
        max_tokens: int = 4096,
        temperature: float = 0.2,
    ) -> LLMResponse:
        from google.genai import types

        config = types.GenerateContentConfig(
            system_instruction=system,
            response_mime_type="application/json",
            temperature=temperature,
            max_output_tokens=max_tokens,
            thinking_config=types.ThinkingConfig(thinking_budget=0),
        )

        # Attempt primary model first, then fall back sequentially if credits/quota are exhausted
        models_to_try = [self.model] + [m for m in self.fallback_models if m != self.model]
        last_error = None

        for candidate_model in models_to_try:
            try:
                resp = self.client.models.generate_content(
                    model=candidate_model,
                    contents=user,
                    config=config,
                )
                # Promote working model for this client instance
                if candidate_model != self.model:
                    self.model = candidate_model

                text = resp.text or ""
                usage = resp.usage_metadata
                return LLMResponse(
                    text=text,
                    provider=self.provider,
                    model=self.model,
                    input_tokens=usage.prompt_token_count if usage else None,
                    output_tokens=usage.candidates_token_count if usage else None,
                )
            except Exception as e:
                last_error = e
                err_str = str(e)
                # Detect quota/credit exhaustion (429 RESOURCE_EXHAUSTED) or model capacity (503 / 404)
                is_quota_or_unavailable = any(
                    marker in err_str
                    for marker in ["429", "RESOURCE_EXHAUSTED", "quota", "credit", "503", "UNAVAILABLE", "404", "NOT_FOUND"]
                )
                if is_quota_or_unavailable and candidate_model != models_to_try[-1]:
                    continue
                raise

        if last_error:
            raise last_error


class OllamaClient:
    """Direct HTTP client for local Ollama instances with native JSON formatting."""

    def __init__(self, cfg: Settings, model: str | None = None):
        self.provider = "ollama"
        self.model = (model or cfg.llm_model or "qwen3.5:latest").strip()
        base = (cfg.llm_base_url or "http://localhost:11434").rstrip("/")
        self.url = f"{base}/api/chat"
        self.timeout = 120.0
        self._client = httpx.Client(timeout=self.timeout)

    def generate(
        self,
        *,
        system: str,
        user: str,
        max_tokens: int = 4096,
        temperature: float = 0.2,
    ) -> LLMResponse:
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "format": "json",
            "stream": False,
            "think": False,
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens,
            },
        }
        try:
            resp = self._client.post(self.url, json=payload)
            resp.raise_for_status()
            data = resp.json()
        except httpx.ConnectError as e:
            raise RuntimeError(
                f"Could not connect to Ollama at {self.url}. "
                "Ensure Ollama is running ('ollama serve') and accessible."
            ) from e
        except httpx.HTTPStatusError as e:
            raise RuntimeError(
                f"Ollama returned HTTP error {e.response.status_code}"
            ) from e

        content = data.get("message", {}).get("content", "")
        return LLMResponse(
            text=content,
            provider=self.provider,
            model=self.model,
            input_tokens=data.get("prompt_eval_count"),
            output_tokens=data.get("eval_count"),
        )


_REGISTRY = {
    "fake": FakeLLM,
    "gemini": GeminiClient,
    "anthropic": AnthropicClient,
    "openai": OpenAIClient,
    "openai_compat": OpenAIClient,
    "ollama": OllamaClient,
}

_client_cache: dict[tuple[str, str], LLMClient] = {}
_cache_lock = threading.Lock()


def build_client(cfg: Settings, model: str | None = None) -> LLMClient:
    """Factory to instantiate and cache LLM clients without global state mutation."""
    target_model = (model or cfg.llm_model).strip()

    if target_model == "fake" or cfg.llm_provider == "fake":
        provider = "fake"
    elif "gemini" in target_model.lower():
        provider = "gemini"
    else:
        provider = cfg.llm_provider.lower().strip()

    cache_key = (provider, target_model)
    with _cache_lock:
        if cache_key in _client_cache:
            return _client_cache[cache_key]

        client_cls = _REGISTRY.get(provider, GeminiClient)
        client = client_cls(cfg, model=target_model)
        _client_cache[cache_key] = client
        return client
