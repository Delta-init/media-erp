"""
Shopify e-commerce demo auth handler.
Returns a self-referential callback URL so the connector auto-connects
with a placeholder token that triggers demo data generation.
"""
from app.config import settings

def get_auth_url(connector_id: str, user_id: str) -> str:
    base = settings.public_base_url.rstrip("/")
    return f"{base}/api/v1/connectors/shopify/callback?connector_id={connector_id}"
