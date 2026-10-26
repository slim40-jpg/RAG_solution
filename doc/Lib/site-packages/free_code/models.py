"""Model routing — select models based on provider and config."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from free_code.config import PROVIDER_MODELS, load_config

# Models available on Free.ai's OpenAI-compatible endpoint
# (https://api.free.ai/v1/chat/completions — ids are whitelisted server-side)
FREE_AI_MODELS = [
    {"id": "qwen7b", "name": "Qwen 7B (fast)", "context": 32768, "free": True},
    {"id": "qwen3-8b", "name": "Qwen3 8B", "context": 32768, "free": True},
]


def get_model(config: Optional[Dict[str, Any]] = None) -> str:
    """Get the model ID to use based on config."""
    if config is None:
        config = load_config()
    model = config.get("model")
    if model:
        return model
    provider = config.get("provider", "free.ai")
    return PROVIDER_MODELS.get(provider, "qwen7b")


def list_models(provider: Optional[str] = None) -> List[Dict[str, Any]]:
    """List available models for a provider."""
    if provider is None or provider == "free.ai":
        return FREE_AI_MODELS
    # For BYOK providers, return a hint list
    hints = {
        "openai": [
            {"id": "gpt-4o", "name": "GPT-4o"},
            {"id": "gpt-4o-mini", "name": "GPT-4o Mini"},
            {"id": "o3-mini", "name": "o3-mini"},
        ],
        "anthropic": [
            {"id": "claude-sonnet-4-20250514", "name": "Claude Sonnet 4"},
            {"id": "claude-haiku-3-5-20241022", "name": "Claude 3.5 Haiku"},
        ],
        "google": [
            {"id": "gemini-2.0-flash", "name": "Gemini 2.0 Flash"},
            {"id": "gemini-2.5-pro", "name": "Gemini 2.5 Pro"},
        ],
        "openrouter": [
            {"id": "anthropic/claude-sonnet-4-20250514", "name": "Claude Sonnet 4"},
            {"id": "openai/gpt-4o", "name": "GPT-4o"},
            {"id": "google/gemini-2.0-flash", "name": "Gemini 2.0 Flash"},
        ],
    }
    return hints.get(provider, [])
