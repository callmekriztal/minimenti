import json
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/minimenti"
    APP_HOST: str = "0.0.0.0"
    APP_PORT: int = 8000
    PORT: int | None = None
    CORS_ORIGINS: list[str] | str = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ]

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @field_validator("DATABASE_URL")
    @classmethod
    def normalize_database_url(cls, value: str) -> str:
        # Render and Heroku provide postgres:// URLs, but SQLAlchemy 2.0 requires postgresql://
        if value.startswith("postgres://"):
            return value.replace("postgres://", "postgresql://", 1)
        return value

    @property
    def server_port(self) -> int:
        return self.PORT or self.APP_PORT

    @field_validator("CORS_ORIGINS")
    @classmethod
    def parse_cors_origins(cls, value: list[str] | str) -> list[str]:
        if isinstance(value, str):
            # Support JSON list or comma-separated string in env vars
            trimmed = value.strip()
            if trimmed.startswith("[") and trimmed.endswith("]"):
                return json.loads(trimmed)
            return [item.strip() for item in trimmed.split(",") if item.strip()]
        return value


settings = Settings()

