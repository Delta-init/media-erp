"""
Mailchimp demo auth handler.
Returns a self-referential callback URL so the connector auto-connects
with a placeholder token that triggers demo data generation.
"""
def get_auth_url(connector_id: str, user_id: str) -> str:
    return f"http://localhost:8001/api/v1/connectors/mailchimp/callback?connector_id={connector_id}"
