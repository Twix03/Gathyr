"""Configuration settings for the backend server."""
from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    """Application settings."""

    # Server settings
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = False  # Override with DEBUG=true in .env for local dev

    # CORS settings — never "*" in production; set CORS_ORIGINS in .env
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    # Where user feedback is stored (outside the git checkout)
    feedback_path: str = "~/.gathyr/feedback.jsonl"

    # Room settings
    room_code_length: int = 6
    max_room_participants: int = 20
    room_cleanup_timeout: int = 3600  # seconds

    # LiveKit credentials (must match the keys in livekit.yaml)
    livekit_api_key: str = Field(..., env="LIVEKIT_API_KEY")
    livekit_api_secret: str = Field(..., env="LIVEKIT_API_SECRET")

    class Config:
        env_file = ".env"
        case_sensitive = False
        extra = "forbid"


settings = Settings()
