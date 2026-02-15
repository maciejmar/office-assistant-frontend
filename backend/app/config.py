from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "office-assistant-backend"
    api_prefix: str = "/api"
    database_url: str = "sqlite:///./office_assistant.db"

    jwt_secret: str = "change-me"
    jwt_alg: str = "HS256"
    access_token_minutes: int = 720
    refresh_token_days: int = 30

    cors_origins: str = "http://localhost:4200"
    cors_allow_credentials: bool = True

    storage_dir: str = "./storage"
    n8n_webhook_url: str = "http://localhost:5678/webhook/office-assistant/newsletter/generate-v3"
    external_extract_url: str = "http://localhost:8001/api/extract-text"
    max_uploaded_files_per_user: int = 20
    max_pdf_size_mb: int = 15
    max_pdf_pages: int = 40

    class Config:
        env_file = ".env"


settings = Settings()
