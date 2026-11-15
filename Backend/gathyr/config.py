"""Runtime configuration, read from environment / Backend/.env."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)

    debug: bool = False

    # Never "*" in production — set CORS_ORIGINS='["https://gathyr.app"]'
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    # LiveKit credentials — must match the keys in livekit.yaml
    livekit_api_key: str
    livekit_api_secret: str
    # Server-side URL used for admin calls (kick); clients use their own VITE_LIVEKIT_URL
    livekit_url: str = "http://127.0.0.1:7880"
    livekit_token_ttl_hours: int = 12

    # Rooms
    room_code_length: int = 6
    max_room_participants: int = 16
    # How long a disconnected participant keeps their seat (refresh, flaky network, phone lock)
    disconnect_grace_seconds: int = 120
    proposal_seconds: int = 15
    chat_history_size: int = 100

    # Feedback is stored outside the git checkout
    feedback_path: str = "~/.gathyr/feedback.jsonl"


settings = Settings()
