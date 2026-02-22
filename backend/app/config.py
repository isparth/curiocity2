from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.1-pro-preview"
    gemini_research_model: str = "gemini-3.1-pro-preview"
    gemini_enable_google_search: bool = True
    deepgram_api_key: str = ""
    elevenlabs_api_key: str = ""
    elevenlabs_voice_id: str = "21m00Tcm4TlvDq8ikWAM"

    # Always read backend/.env regardless of process working directory.
    model_config = SettingsConfigDict(env_file=BASE_DIR / ".env")


settings = Settings()
