"""Central config. SQLite by default; set DATABASE_URL for PostgreSQL."""
from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]  # backend/
STORAGE_DIR = BASE_DIR / "storage"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="FAA_")

    app_name: str = "Audio Forensics API"
    database_url: str = f"sqlite:///{BASE_DIR / 'forensic.db'}"
    storage_dir: Path = STORAGE_DIR
    max_upload_mb: int = 500


settings = Settings()
