from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Read once from the environment (or .env locally); never imported by domain code."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: Literal["development", "test", "production"] = "development"
    internal_api_key: str = Field(min_length=16)

    groq_api_key: str = ""
    groq_model: str = "openai/gpt-oss-120b"
    cloudflare_account_id: str = ""
    cloudflare_api_token: str = ""
    cloudflare_model: str = "@cf/meta/llama-3.3-70b-instruct-fp8-fast"

    searchapi_key: str = ""
    search_cache_ttl_seconds: int = 6 * 60 * 60

    geocoder_enabled: bool = True
    nominatim_url: str = "https://nominatim.openstreetmap.org"
    osrm_url: str = "https://router.project-osrm.org"
    # Relative paths are read from the ai-service folder.
    timetable_path: str = "data/timetable.json.gz"
