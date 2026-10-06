"""Pluggable interface for model access. OllamaAdapter talks to a local
Ollama server; HostedAdapter is an unimplemented stub for a future hosted
API. Every call site in app/model_tasks.py goes through the ModelAdapter
interface, so swapping models is a config change (see app/config.py),
never a code change at the call site.
"""
from __future__ import annotations

import json
from abc import ABC, abstractmethod

import httpx

from app import config


class ModelAdapter(ABC):
    """Turns a system/user prompt pair and a JSON schema into a parsed
    dict, or None if the model could not produce a valid response."""

    @abstractmethod
    def generate_json(self, system_prompt: str, user_prompt: str, schema: dict) -> dict | None:
        raise NotImplementedError


class OllamaAdapter(ModelAdapter):
    def __init__(self, base_url: str, model: str, timeout_seconds: float = 60.0):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout_seconds = timeout_seconds

    def generate_json(self, system_prompt: str, user_prompt: str, schema: dict) -> dict | None:
        try:
            response = httpx.post(
                f"{self.base_url}/api/chat",
                json={
                    "model": self.model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    "stream": False,
                    "think": False,
                    "format": schema,
                    "options": {"temperature": 0},
                },
                timeout=self.timeout_seconds,
            )
            response.raise_for_status()
        except httpx.HTTPError:
            return None

        try:
            content = response.json()["message"]["content"]
            parsed = json.loads(content)
        except (KeyError, ValueError, json.JSONDecodeError):
            return None

        return parsed if isinstance(parsed, dict) else None


class HostedAdapter(ModelAdapter):
    """Stub for a future hosted-API model (e.g. an Anthropic/OpenAI
    endpoint). Not wired up by default -- exists so MODEL_ADAPTER=hosted
    in .env has an implementation to configure instead of a code change."""

    def __init__(self, api_key: str | None = None, model: str | None = None):
        self.api_key = api_key
        self.model = model

    def generate_json(self, system_prompt: str, user_prompt: str, schema: dict) -> dict | None:
        raise NotImplementedError("HostedAdapter is not configured yet.")


_adapter: ModelAdapter | None = None


def build_model_adapter() -> ModelAdapter:
    if config.MODEL_ADAPTER == "hosted":
        return HostedAdapter()
    return OllamaAdapter(config.OLLAMA_BASE_URL, config.OLLAMA_MODEL, config.MODEL_TIMEOUT_SECONDS)


def get_model_adapter() -> ModelAdapter:
    """FastAPI dependency. A single adapter instance is reused across
    requests (it is stateless besides config); tests override this via
    app.dependency_overrides."""
    global _adapter
    if _adapter is None:
        _adapter = build_model_adapter()
    return _adapter
