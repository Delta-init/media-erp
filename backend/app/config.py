from functools import lru_cache
from pathlib import Path
from pydantic import model_validator
from pydantic_settings import BaseSettings

# Resolve .env relative to this file so it works regardless of where uvicorn is launched from >>
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

    # AI — Gemini is used when GEMINI_API_KEY is set (recommended for production).
    # Ollama is the fallback for local/offline setups.
    gemini_api_key: str = ""
    gemini_model:   str = "gemini-1.5-flash"   # fast + cheap; override with gemini-1.5-pro

    # Ollama (local AI — no API key needed, requires `ollama serve` on the server)
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

    # ── Base URL ──────────────────────────────────────────────────────────────
    # Single source of truth for all redirect URIs and public file URLs.
    # Set PUBLIC_BASE_URL in .env to your domain (e.g. https://api.example.com).
    # All redirect URIs below are auto-derived from this value if left empty.
    public_base_url: str = "http://localhost:8000"

    # ── Google OAuth2 (Google Ads + GA4) ──────────────────────────────────────
    google_client_id: str = ""
    google_client_secret: str = ""
    google_ads_developer_token: str = ""
    google_ads_redirect_uri: str = ""   # auto-derived if empty
    ga4_redirect_uri: str = ""          # auto-derived if empty

    # ── Facebook / Meta ───────────────────────────────────────────────────────
    facebook_webhook_verify_token: str = "mediaerp_webhook_verify"
    facebook_app_id: str = ""
    facebook_app_secret: str = ""
    facebook_redirect_uri: str = ""         # auto-derived if empty
    facebook_pages_redirect_uri: str = ""   # auto-derived if empty

    # ── Instagram ─────────────────────────────────────────────────────────────
    instagram_redirect_uri: str = ""        # auto-derived if empty
    instagram_app_id: str = ""
    instagram_app_secret: str = ""
    instagram_login_redirect_uri: str = ""  # auto-derived if empty

    # ── LinkedIn Ads ──────────────────────────────────────────────────────────
    linkedin_client_id: str = ""
    linkedin_client_secret: str = ""
    linkedin_redirect_uri: str = ""         # auto-derived if empty

    # ── TikTok Ads ────────────────────────────────────────────────────────────
    tiktok_app_id: str = ""
    tiktok_app_secret: str = ""
    tiktok_redirect_uri: str = ""           # auto-derived if empty

    # ── Stripe ────────────────────────────────────────────────────────────────
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_price_free_monthly: str = ""
    stripe_price_free_yearly: str = ""
    stripe_price_pro_monthly: str = ""
    stripe_price_pro_yearly: str = ""
    stripe_price_enterprise_monthly: str = ""
    stripe_price_enterprise_yearly: str = ""

    model_config = {"env_file": str(_ENV_FILE), "case_sensitive": False, "extra": "ignore"}

    @model_validator(mode="after")
    def _build_redirect_uris(self) -> "Settings":
        """
        Auto-derive any empty redirect URI from public_base_url.
        Override a specific URI in .env to bypass auto-derivation, e.g.:
            GOOGLE_ADS_REDIRECT_URI=https://custom.domain/callback
        """
        base = self.public_base_url.rstrip("/")
        cb = f"{base}/api/v1/connectors"

        if not self.google_ads_redirect_uri:
            self.google_ads_redirect_uri = f"{cb}/google_ads/callback"
        if not self.ga4_redirect_uri:
            self.ga4_redirect_uri = f"{cb}/ga4/callback"
        if not self.facebook_redirect_uri:
            self.facebook_redirect_uri = f"{cb}/facebook_ads/callback"
        if not self.facebook_pages_redirect_uri:
            self.facebook_pages_redirect_uri = f"{cb}/facebook_pages/callback"
        if not self.instagram_redirect_uri:
            self.instagram_redirect_uri = f"{cb}/instagram/callback"
        if not self.instagram_login_redirect_uri:
            self.instagram_login_redirect_uri = f"{cb}/instagram_login/callback"
        if not self.linkedin_redirect_uri:
            self.linkedin_redirect_uri = f"{cb}/linkedin_ads/callback"
        if not self.tiktok_redirect_uri:
            self.tiktok_redirect_uri = f"{cb}/tiktok_ads/callback"

        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


# Always read fresh from .env — clear cache so --reload picks up changes
get_settings.cache_clear()
settings = get_settings()
