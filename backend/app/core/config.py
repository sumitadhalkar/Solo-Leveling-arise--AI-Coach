from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    GEMINI_API_KEY: str = ""
    GEMINI_API_KEY_2: str = ""
    LLM_MODEL: str = "gemini-2.0-flash"


settings = Settings()
