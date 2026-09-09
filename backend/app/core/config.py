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

    # Second provider slot — pinned to NVIDIA NIM only (OpenAI-compatible
    # chat-completions protocol). This app supports exactly two providers:
    # Gemini and NVIDIA. BASE_URL/MODEL are intentionally not configurable
    # via env var so this slot can't be silently repointed at another
    # provider — only the API key(s) and, optionally, which NVIDIA-hosted
    # model to use are.
    # Optional: the app runs on Gemini alone if no NVIDIA key is set. See
    # app/rag/pipeline.py's provider-selection comment for why this slot only
    # ever handles non-search requests (no provider behind it can match
    # Gemini's live Google Search grounding).
    NVIDIA_API_KEY: str = ""
    NVIDIA_API_KEY_2: str = ""
    NVIDIA_BASE_URL: str = "https://integrate.api.nvidia.com/v1"
    NVIDIA_LLM_MODEL: str = "deepseek-ai/deepseek-v4-pro-0813"

    # Backward-compatible aliases: an older .env may still set these generic
    # names. They're honored only as an alternate source for the NVIDIA key
    # and model — never for BASE_URL, which stays pinned to NVIDIA above.
    OPENAI_COMPATIBLE_API_KEY: str = ""
    OPENAI_COMPATIBLE_API_KEY_2: str = ""
    OPENAI_COMPATIBLE_MODEL: str = ""

    # Optional shared secret guarding /api/v1/admin/* — that route forces an
    # immediate live Gemini Search call, so leaving it open lets anyone who
    # can reach the API trigger cost/quota usage on demand. Left blank by
    # default so existing deployments don't break; set it to lock the route
    # down and pass the same value as an `X-Admin-Token` header.
    ADMIN_TOKEN: str = ""

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
        keys = self._split_keys(self.NVIDIA_API_KEY, self.NVIDIA_API_KEY_2)
        return keys or self._split_keys(self.OPENAI_COMPATIBLE_API_KEY, self.OPENAI_COMPATIBLE_API_KEY_2)

    def compat_base_url(self) -> str:
        return self.NVIDIA_BASE_URL

    def compat_model(self) -> str:
        return self.NVIDIA_LLM_MODEL or self.OPENAI_COMPATIBLE_MODEL

    def compat_label(self) -> str:
        return "nvidia"


settings = Settings()
