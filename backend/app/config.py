from functools import lru_cache
from pathlib import Path
from pydantic_settings import BaseSettings

# Resolve .env relative to this file so it works regardless of where uvicorn is launched from
_ENV_FILE = Path(__file__).parent.parent / ".env"


class Settings(BaseSettings):
    app_env: str = "development"
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    debug: bool = True

    mongodb_url: str = "mongodb://localhost:27017"
    mongodb_db_name: str = "mediaerp"

    redis_url: str = "redis://localhost:6379/0"

    jwt_secret_key: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    encryption_key: str = "0" * 64  # 32-byte hex placeholder

    # Ollama (local AI — no API key needed)
    ollama_base_url: str = "http://localhost:11434"
    ollama_model:    str = "llama3.2:3b"

    # Email (SMTP)
    mail_username: str = ""
    mail_password: str = ""
    mail_from: str = ""
    mail_port: int = 587
    mail_server: str = "smtp.gmail.com"
    mail_from_name: str = "mediaERP"

    # Sentry (optional — leave empty to disable)
    sentry_dsn: str = ""

    # Worker concurrency (Railway / Docker env override)
    web_concurrency: int = 2
    celery_concurrency: int = 2

    allowed_origins: str = "http://localhost:3000,http://localhost:3001"
    frontend_url: str = "http://localhost:3000"

    # Google OAuth2 (shared by Google Ads + GA4)
    google_client_id: str = ""
    google_client_secret: str = ""
    google_ads_developer_token: str = ""
    google_ads_redirect_uri: str = (
        "http://localhost:8000/api/v1/connectors/google_ads/callback"
    )
    ga4_redirect_uri: str = (
        "http://localhost:8000/api/v1/connectors/ga4/callback"
    )

    # Facebook / Meta Webhook
    facebook_webhook_verify_token: str = "mediaerp_webhook_verify"

    # Facebook Ads
    facebook_app_id: str = ""
    facebook_app_secret: str = ""
    facebook_redirect_uri: str = (
        "http://localhost:8000/api/v1/connectors/facebook_ads/callback"
    )
    facebook_pages_redirect_uri: str = (
        "http://localhost:8000/api/v1/connectors/facebook_pages/callback"
    )

    # Instagram (Graph API via Facebook Login)
    instagram_redirect_uri: str = (
        "http://localhost:8000/api/v1/connectors/instagram/callback"
    )

    # Instagram Login (direct IG OAuth — separate Instagram app, no Facebook Page required)
    instagram_app_id: str = ""
    instagram_app_secret: str = ""
    instagram_login_redirect_uri: str = (
        "http://localhost:8000/api/v1/connectors/instagram_login/callback"
    )

    # LinkedIn Ads
    linkedin_client_id: str = ""
    linkedin_client_secret: str = ""
    linkedin_redirect_uri: str = (
        "http://localhost:8000/api/v1/connectors/linkedin_ads/callback"
    )

    # TikTok Ads
    tiktok_app_id: str = ""
    tiktok_app_secret: str = ""
    tiktok_redirect_uri: str = (
        "http://localhost:8000/api/v1/connectors/tiktok_ads/callback"
    )

    # Stripe (leave empty to run in demo mode — no live payments)
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_price_free_monthly: str = ""
    stripe_price_free_yearly: str = ""
    stripe_price_pro_monthly: str = ""
    stripe_price_pro_yearly: str = ""
    stripe_price_enterprise_monthly: str = ""
    stripe_price_enterprise_yearly: str = ""

    # Public base URL (used to build publicly-accessible file URLs for image uploads)
    # In development set to your ngrok static domain so Instagram can fetch images.
    # In production set to your actual domain.
    public_base_url: str = "http://localhost:8000"

    model_config = {"env_file": str(_ENV_FILE), "case_sensitive": False, "extra": "ignore"}


@lru_cache
def get_settings() -> Settings:
    return Settings()


# Always read fresh from .env — clear cache so --reload picks up changes
get_settings.cache_clear()
settings = get_settings()
