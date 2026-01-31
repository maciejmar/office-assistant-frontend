from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "office-assistant-backend"
    api_prefix: str = "/api"
    database_url: str = "sqlite:///./office_assistant.db"

    jwt_secret: str = "change-me"
    jwt_alg: str = "HS256"
    access_token_minutes: int = 30
    refresh_token_days: int = 30

    cors_origins: str = "http://localhost:4200"
    cors_allow_credentials: bool = True

    storage_dir: str = "./storage"
    n8n_webhook_url: str = "http://localhost:5678/webhook/office-assistant/newsletter/generate"
    external_extract_url: str = "http://localhost:8000/api/extract-text"

    class Config:
        env_file = ".env"


settings = Settings()
