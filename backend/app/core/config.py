import re

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Each of these fields accepts either a single key or several — separated
    # by commas, semicolons, or newlines, e.g. GEMINI_API_KEY=key1,key2,key3.
    # _KEY and _KEY_2 both exist only for backward compatibility with older
    # .env files; either one (or both) may hold a whole list. Use gemini_keys()
    # / nvidia_keys() below to get the fully merged, deduped list — never read
    # these fields directly.
    GEMINI_API_KEY: str = ""
    GEMINI_API_KEY_2: str = ""
    LLM_MODEL: str = "gemini-3.6-flash"

    # Generic OpenAI-compatible provider slot — works with ANY service that
    # speaks the OpenAI chat-completions protocol: NVIDIA NIM, Groq, Together,
    # DeepSeek, Fireworks, OpenRouter, Mistral's La Plateforme, a local
    # Ollama/vLLM server, and most others. A raw API key alone carries no
    # signature saying which provider it belongs to, so there's no way to
    # accept "any key" with zero configuration — but any key from a provider
    # that speaks this near-universal protocol works as soon as you point
    # BASE_URL at it (Anthropic/Claude is the notable exception: different
    # protocol entirely, not covered by this slot).
    # Optional: the app runs on Gemini alone if these are left blank. See
    # app/rag/pipeline.py's provider-selection comment for why this slot only
    # ever handles non-search requests (no provider behind it can match
    # Gemini's live Google Search grounding).
    OPENAI_COMPATIBLE_API_KEY: str = ""
    OPENAI_COMPATIBLE_API_KEY_2: str = ""
    OPENAI_COMPATIBLE_BASE_URL: str = ""
    OPENAI_COMPATIBLE_MODEL: str = ""
    OPENAI_COMPATIBLE_LABEL: str = ""  # optional friendly name for log lines, e.g. "groq"

    # Legacy NVIDIA-specific names — still honored as a fallback (see the
    # compat_* methods below) so an existing .env doesn't need to change.
    # NVIDIA_BASE_URL/NVIDIA_LLM_MODEL also serve as this slot's defaults,
    # since NVIDIA is what it was built against first.
    NVIDIA_API_KEY: str = ""
    NVIDIA_API_KEY_2: str = ""
    NVIDIA_BASE_URL: str = "https://integrate.api.nvidia.com/v1"
    NVIDIA_LLM_MODEL: str = "meta/llama-3.3-70b-instruct"

    @staticmethod
    def _split_keys(*raw: str) -> list[str]:
        """Merge one or more key-bearing env values into a single deduped,
        order-preserving list. Each value may itself hold any number of keys."""
        keys: list[str] = []
        seen: set[str] = set()
        for blob in raw:
            for piece in re.split(r"[,;\n]+", blob or ""):
                k = piece.strip()
                if k and k not in seen:
                    seen.add(k)
                    keys.append(k)
        return keys

    def gemini_keys(self) -> list[str]:
        return self._split_keys(self.GEMINI_API_KEY, self.GEMINI_API_KEY_2)

    def compat_keys(self) -> list[str]:
        keys = self._split_keys(self.OPENAI_COMPATIBLE_API_KEY, self.OPENAI_COMPATIBLE_API_KEY_2)
        return keys or self._split_keys(self.NVIDIA_API_KEY, self.NVIDIA_API_KEY_2)

    def compat_base_url(self) -> str:
        return self.OPENAI_COMPATIBLE_BASE_URL or self.NVIDIA_BASE_URL

    def compat_model(self) -> str:
        return self.OPENAI_COMPATIBLE_MODEL or self.NVIDIA_LLM_MODEL

    def compat_label(self) -> str:
        """Best-effort friendly name for log lines — inferred from the base
        URL's hostname so it's useful without extra config, overridable via
        OPENAI_COMPATIBLE_LABEL for anything the heuristic doesn't catch."""
        if self.OPENAI_COMPATIBLE_LABEL:
            return self.OPENAI_COMPATIBLE_LABEL
        url = self.compat_base_url().lower()
        for needle, name in (
            ("nvidia", "nvidia"), ("groq", "groq"), ("together", "together"),
            ("deepseek", "deepseek"), ("openrouter", "openrouter"),
            ("fireworks", "fireworks"), ("mistral", "mistral"),
            ("localhost", "local"), ("127.0.0.1", "local"), ("0.0.0.0", "local"),
        ):
            if needle in url:
                return name
        return "custom"


settings = Settings()
