"""LLM model registry and use-case presets for sanctioned providers."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional


@dataclass
class ModelConfig:
    """Configuration for a specific provider model."""

    model_id: str
    temperature: float = 0.3
    max_tokens: int = 4000
    top_p: float = 1.0
    extra_params: Dict = field(default_factory=dict)


@dataclass
class ModelPreset:
    """Preset configuration for a use case (chatbot, research, extraction)."""

    primary: ModelConfig
    fallbacks: List[ModelConfig] = field(default_factory=list)


# Supported cloud models
MINIMAX_M27 = ModelConfig(
    model_id="minimax/MiniMax-M2.7",
    temperature=0.2,
    max_tokens=4000,
)

ZAI_GLM_47_FLASH = ModelConfig(
    model_id="openai/glm-4.7-flash",
    temperature=0.2,
    max_tokens=4000,
)

GROQ_QWEN3_32B = ModelConfig(
    model_id="groq/qwen/qwen3-32b",
    temperature=0.6,
    max_tokens=8000,
    top_p=0.95,
)

GROQ_LLAMA_70B = ModelConfig(
    model_id="groq/llama-3.3-70b-versatile",
    temperature=0.3,
    max_tokens=8000,
)

GROQ_LLAMA_8B = ModelConfig(
    model_id="groq/llama-3.1-8b-instant",
    temperature=0.3,
    max_tokens=4000,
)


# Use-case presets
CHATBOT_PRESET = ModelPreset(
    primary=GROQ_QWEN3_32B,
    fallbacks=[GROQ_LLAMA_70B],
)

RESEARCH_PRESET = ModelPreset(
    primary=GROQ_QWEN3_32B,
    fallbacks=[GROQ_LLAMA_70B],
)

# Extraction/merge run on Groq (free, env key) by default. Minimax/Z.AI are
# pay/deprecated here — kept as ModelConfigs above for explicit routing only.
EXTRACTION_PRESET = ModelPreset(
    primary=GROQ_QWEN3_32B,
    fallbacks=[GROQ_LLAMA_70B],
)

MERGE_PRESET = ModelPreset(
    primary=GROQ_QWEN3_32B,
    fallbacks=[GROQ_LLAMA_70B],
)

REPORT_PRESET = ModelPreset(
    primary=GROQ_QWEN3_32B,
    fallbacks=[GROQ_LLAMA_70B],
)

COMPRESSION_PRESET = ModelPreset(
    primary=GROQ_LLAMA_70B,
    fallbacks=[GROQ_LLAMA_8B],
)

# IBD industry-group classification (closed-set tiebreaker). Low temperature for
# deterministic single-label selection. This is the *sanctioned* fallback used
# when the env-driven OpenAI-compatible path (IBD_LLM_*) is not configured.
IBD_CLASSIFICATION_GROQ = ModelConfig(
    model_id="groq/llama-3.3-70b-versatile",
    temperature=0.1,
    max_tokens=200,
)
IBD_CLASSIFICATION_GROQ_SMALL = ModelConfig(
    model_id="groq/llama-3.1-8b-instant",
    temperature=0.1,
    max_tokens=200,
)
IBD_CLASSIFICATION_PRESET = ModelPreset(
    primary=IBD_CLASSIFICATION_GROQ,
    fallbacks=[IBD_CLASSIFICATION_GROQ_SMALL],
)


PROVIDER_ENV_VARS = {
    "groq": "GROQ_API_KEY",
    "zai": "ZAI_API_KEY",
    "minimax": "MINIMAX_API_KEY",
}


# Hermes gateway pseudo-model: routes through the assistant gateway, which runs
# whatever the in-chat model picker selected (local Ollama, Claude Pro, ChatGPT
# Plus / Codex — subscription auth is saved in Hermes' auth.json).
HERMES_MODEL_ID = "hermes/hermes-agent"

# Prefix for dynamic local models served by Ollama (enumerated live, not listed
# here). Example id: "ollama/gemma4:latest".
OLLAMA_MODEL_PREFIX = "ollama/"

AVAILABLE_MODELS = [
    {"id": "groq/qwen/qwen3-32b", "name": "Qwen 3 32B (Groq, free)", "provider": "groq", "category": "cloud"},
    {"id": "groq/llama-3.3-70b-versatile", "name": "Llama 3.3 70B (Groq, free)", "provider": "groq", "category": "cloud"},
    {"id": "groq/llama-3.1-8b-instant", "name": "Llama 3.1 8B (Groq, free)", "provider": "groq", "category": "cloud"},
    {
        "id": HERMES_MODEL_ID,
        "name": "Hermes gateway (assistant model — Claude Pro / ChatGPT Plus / local)",
        "provider": "hermes",
        "category": "cloud",
    },
]

_GROQ_MODEL_IDS = {
    "groq/qwen/qwen3-32b",
    "groq/llama-3.3-70b-versatile",
    "groq/llama-3.1-8b-instant",
}

SUPPORTED_MODELS_BY_USE_CASE: dict[str, set[str]] = {
    "chatbot": set(_GROQ_MODEL_IDS),
    "research": set(_GROQ_MODEL_IDS),
    "extraction": _GROQ_MODEL_IDS | {HERMES_MODEL_ID},
    "merge": _GROQ_MODEL_IDS | {HERMES_MODEL_ID},
    "ibd_classification": _GROQ_MODEL_IDS | {HERMES_MODEL_ID},
}

# Use cases whose model may also be any dynamic local Ollama model.
_OLLAMA_ALLOWED_USE_CASES = {"extraction", "merge", "ibd_classification"}


DEFAULT_MODEL_BY_USE_CASE: dict[str, str] = {
    "chatbot": "groq/qwen/qwen3-32b",
    "research": "groq/qwen/qwen3-32b",
    "extraction": "groq/qwen/qwen3-32b",
    "merge": "groq/qwen/qwen3-32b",
    "ibd_classification": "groq/llama-3.3-70b-versatile",
}


def get_model_by_id(model_id: str) -> Optional[Dict]:
    """Get model info by ID."""
    for model in AVAILABLE_MODELS:
        if model["id"] == model_id:
            return model
    return None


def get_models_by_provider(provider: str) -> List[Dict]:
    """Get all models for a specific provider."""
    return [m for m in AVAILABLE_MODELS if m["provider"] == provider]


def get_models_by_category(category: str) -> List[Dict]:
    """Get all models by category."""
    return [m for m in AVAILABLE_MODELS if m["category"] == category]


def get_preset_for_use_case(use_case: str) -> ModelPreset:
    """Get model preset for the selected use case."""
    presets = {
        "chatbot": CHATBOT_PRESET,
        "research": RESEARCH_PRESET,
        "extraction": EXTRACTION_PRESET,
        "merge": MERGE_PRESET,
        "report": REPORT_PRESET,
        "compression": COMPRESSION_PRESET,
        "ibd_classification": IBD_CLASSIFICATION_PRESET,
    }
    return presets.get(use_case, CHATBOT_PRESET)


def get_fallback_chain(preset: ModelPreset) -> List[str]:
    """Get ordered fallback chain for a model preset."""
    models = [preset.primary.model_id]
    for fallback in preset.fallbacks:
        models.append(fallback.model_id)
    return models


def get_model_params(model_config: ModelConfig, **overrides) -> Dict:
    """Build LiteLLM params for a model config."""
    params = {
        "model": model_config.model_id,
        "temperature": model_config.temperature,
        "max_tokens": model_config.max_tokens,
    }
    if model_config.top_p != 1.0:
        params["top_p"] = model_config.top_p
    params.update(model_config.extra_params)
    params.update(overrides)
    return params


def is_model_supported_for_use_case(*, model_id: str, use_case: str) -> bool:
    """Return True when model is sanctioned for the requested use case.

    Dynamic local models (``ollama/<model>``) are allowed for the offline-safe
    use cases; the concrete model list comes from the live Ollama instance.
    """
    if use_case in _OLLAMA_ALLOWED_USE_CASES and model_id.startswith(OLLAMA_MODEL_PREFIX):
        return len(model_id) > len(OLLAMA_MODEL_PREFIX)
    allowed = SUPPORTED_MODELS_BY_USE_CASE.get(use_case)
    if not allowed:
        return False
    return model_id in allowed
