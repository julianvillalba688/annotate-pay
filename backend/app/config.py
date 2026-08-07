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
