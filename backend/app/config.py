"""Application settings loaded from environment variables."""

from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_jwt_secret: str = ""
    allowed_origins: str = "http://localhost:3000"
    port: int = 8000
    allrates_api_key: str = ""
    fx_cache_ttl_seconds: int = 60 * 60

    @field_validator("allrates_api_key", mode="before")
    @classmethod
    def strip_allrates_api_key(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("fx_cache_ttl_seconds")
    @classmethod
    def validate_fx_cache_ttl(cls, value: int) -> int:
        if value <= 0:
            raise ValueError("fx_cache_ttl_seconds must be greater than zero")
        return value

    @field_validator("supabase_url")
    @classmethod
    def strip_trailing_slash(cls, value: str) -> str:
        return value.rstrip("/") if value else value

    @property
    def cors_origins(self) -> list[str]:
        if not self.allowed_origins.strip():
            return ["http://localhost:3000"]
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

    @property
    def supabase_rest_url(self) -> str:
        return f"{self.supabase_url}/rest/v1"


@lru_cache
def get_settings() -> Settings:
    return Settings()
