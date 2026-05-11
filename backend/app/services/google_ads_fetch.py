"""
Google Ads data fetcher — Phase 3.4.

Fetches the last 30 days of campaign-level daily performance metrics
via the Google Ads REST API v18 (GAQL, paginated search).

Connector field used   : platform_account_id → Google Ads customer ID
                         (auto-discovered on first sync if not set)

Data mapping
------------
  date          → segments.date   (YYYY-MM-DD)
  campaign_id   → campaign.id
  campaign_name → campaign.name
  impressions   → metrics.impressions
  clicks        → metrics.clicks
  spend         → metrics.cost_micros / 1_000_000
  conversions   → metrics.conversions   (rounded to int)
  revenue       → metrics.conversions_value
  device        → segments.device       (MOBILE / DESKTOP / TABLET / None)

Registration
------------
    PLATFORM_FETCH_REGISTRY["google_ads"] = fetch_data
    Called from sync_service._register_platforms() at module load.
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

import httpx

from app.config import settings
from app.database import get_sync_db
from app.models.marketing_data import marketing_data_doc, compute_derived_metrics

logger = logging.getLogger(__name__)

_API_BASE = "https://googleads.googleapis.com/v18"
_TOKEN_URL = "https://oauth2.googleapis.com/token"

# Google Ads device segment → normalised label
_DEVICE_MAP: dict[str, Optional[str]] = {
    "MOBILE": "mobile",
    "DESKTOP": "desktop",
    "TABLET": "tablet",
    "CONNECTED_TV": "ctv",
    "UNSPECIFIED": None,
    "UNKNOWN": None,
}

# ── GAQL query ─────────────────────────────────────────────────────────────────
_GAQL = """\
SELECT
  customer.id,
  campaign.id,
  campaign.name,
  segments.date,
  segments.device,
  metrics.impressions,
  metrics.clicks,
  metrics.cost_micros,
  metrics.conversions,
  metrics.conversions_value
FROM campaign
WHERE segments.date DURING LAST_30_DAYS
  AND campaign.status != 'REMOVED'
ORDER BY segments.date DESC
LIMIT 10000\
"""


# ── Token helpers ──────────────────────────────────────────────────────────────

def _refresh_google_token(refresh_token: str) -> tuple[str, datetime]:
    """Exchange a refresh token for a new access token (synchronous)."""
    with httpx.Client(timeout=30) as client:
        resp = client.post(
            _TOKEN_URL,
            data={
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
            },
        )
    if resp.status_code != 200:
        raise RuntimeError(f"Google token refresh failed ({resp.status_code}): {resp.text}")
    data = resp.json()
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=data.get("expires_in", 3600))
    return data["access_token"], expires_at


def _get_valid_token(connector: dict, tokens: dict) -> str:
    """
    Return a valid access token, auto-refreshing if within 5 min of expiry.
    Persists the new encrypted token to MongoDB on refresh.
    """
    expires_at: Optional[datetime] = connector.get("token_expires_at")
    now = datetime.now(timezone.utc)

    if expires_at:
        # PyMongo sync client returns naive UTC datetimes — normalise
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at > now + timedelta(minutes=5):
            return tokens["access_token"]  # still valid

    refresh_token = tokens.get("refresh_token")
    if not refresh_token:
        logger.warning("No refresh token available; using potentially expired access token")
        return tokens["access_token"]

    logger.info("Refreshing Google Ads access token for connector %s", connector.get("_id"))
    new_token, new_expires = _refresh_google_token(refresh_token)

    from app.utils.encryption import encrypt
    get_sync_db()["connectors"].update_one(
        {"_id": connector["_id"]},
        {"$set": {
            "encrypted_access_token": encrypt(new_token),
            "token_expires_at": new_expires,
            "updated_at": now,
        }},
    )
    return new_token


# ── Customer ID resolution ─────────────────────────────────────────────────────

def _list_accessible_customers(access_token: str) -> list[str]:
    """Return numeric customer IDs accessible with this token."""
    with httpx.Client(timeout=30) as client:
        resp = client.get(
            f"{_API_BASE}/customers:listAccessibleCustomers",
            headers={
                "Authorization": f"Bearer {access_token}",
                "developer-token": settings.google_ads_developer_token,
            },
        )
    if resp.status_code != 200:
        raise RuntimeError(f"listAccessibleCustomers failed ({resp.status_code}): {resp.text}")
    resources = resp.json().get("resourceNames", [])
    # "customers/1234567890" → "1234567890"
    return [r.split("/")[1] for r in resources]


def _resolve_customer_id(connector: dict, access_token: str) -> str:
    """
    Return the Google Ads customer ID to sync.
    If platform_account_id is set on the connector, use it.
    Otherwise discover and save the first accessible customer.
    """
    stored_id = connector.get("platform_account_id")
    if stored_id:
        return stored_id.replace("-", "")  # "123-456-7890" → "1234567890"

    customers = _list_accessible_customers(access_token)
    if not customers:
        raise RuntimeError("No accessible Google Ads customer accounts found")

    customer_id = customers[0]
    logger.info(
        "Discovered Google Ads customer_id=%s for connector %s",
        customer_id, connector.get("_id"),
    )
    get_sync_db()["connectors"].update_one(
        {"_id": connector["_id"]},
        {"$set": {
            "platform_account_id": customer_id,
            "updated_at": datetime.now(timezone.utc),
        }},
    )
    return customer_id


# ── API call + pagination ──────────────────────────────────────────────────────

def _search_campaigns(customer_id: str, access_token: str) -> list[dict]:
    """
    Execute the GAQL query against a customer account with full pagination.
    Returns a flat list of raw API result rows.
    """
    url = f"{_API_BASE}/customers/{customer_id}/googleAds:search"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "developer-token": settings.google_ads_developer_token,
        "Content-Type": "application/json",
    }

    all_rows: list[dict] = []
    next_page_token: Optional[str] = None

    with httpx.Client(timeout=60) as client:
        while True:
            payload: dict = {"query": _GAQL}
            if next_page_token:
                payload["pageToken"] = next_page_token

            resp = client.post(url, headers=headers, json=payload)

            if resp.status_code == 401:
                raise RuntimeError("Google Ads API: 401 Unauthorized — token expired or revoked")
            if resp.status_code != 200:
                raise RuntimeError(
                    f"Google Ads API error {resp.status_code}: {resp.text}"
                )

            data = resp.json()
            all_rows.extend(data.get("results", []))

            next_page_token = data.get("nextPageToken")
            if not next_page_token:
                break

    return all_rows


# ── Row parsing ────────────────────────────────────────────────────────────────

def _parse_rows(rows: list[dict], connector: dict) -> list[dict]:
    """Convert raw Google Ads API rows into marketing_data_doc-shaped dicts."""
    user_id = connector["user_id"]
    connector_id = str(connector["_id"])
    account_id = str(connector.get("platform_account_id", ""))

    docs: list[dict] = []
    for row in rows:
        campaign = row.get("campaign", {})
        segments = row.get("segments", {})
        metrics  = row.get("metrics", {})
        customer = row.get("customer", {})

        campaign_id   = str(campaign.get("id", ""))
        campaign_name = campaign.get("name", "")
        date_str      = segments.get("date", "")   # "YYYY-MM-DD"

        raw_device = segments.get("device", "UNSPECIFIED")
        device = _DEVICE_MAP.get(raw_device, None)

        # Google Ads REST API serialises int64 fields as strings
        impressions  = int(metrics.get("impressions", "0") or 0)
        clicks       = int(metrics.get("clicks", "0") or 0)
        cost_micros  = int(metrics.get("costMicros", "0") or 0)
        spend        = cost_micros / 1_000_000
        # conversions is a double (fractional attribution model)
        conversions  = int(float(metrics.get("conversions", 0) or 0))
        revenue      = float(metrics.get("conversionsValue", 0.0) or 0.0)

        derived = compute_derived_metrics(impressions, clicks, spend, revenue)

        effective_account_id = account_id or str(customer.get("id", ""))

        docs.append(marketing_data_doc(
            user_id=user_id,
            connector_id=connector_id,
            platform="google_ads",
            date=date_str,
            account_id=effective_account_id,
            campaign_id=campaign_id,
            campaign_name=campaign_name,
            impressions=impressions,
            clicks=clicks,
            spend=spend,
            conversions=conversions,
            revenue=revenue,
            ctr=derived["ctr"],
            cpc=derived["cpc"],
            roas=derived["roas"],
            device=device,
            currency="USD",
        ))

    return docs


# ── Public entry point ─────────────────────────────────────────────────────────

def fetch_data(connector: dict, tokens: dict) -> list[dict]:
    """
    Fetch Google Ads campaign metrics for the last 30 days.

    Called by sync_service.run_sync() via PLATFORM_FETCH_REGISTRY["google_ads"].

    Args:
        connector : MongoDB connector document (plain dict from PyMongo)
        tokens    : {"access_token": str, "refresh_token": str | None}
                    (already decrypted by sync_service)

    Returns:
        List of marketing_data_doc-shaped dicts ready for bulk upsert.
    """
    access_token = _get_valid_token(connector, tokens)
    customer_id  = _resolve_customer_id(connector, access_token)

    logger.info(
        "Google Ads fetch start: customer_id=%s connector=%s",
        customer_id, connector.get("_id"),
    )

    raw_rows = _search_campaigns(customer_id, access_token)
    docs = _parse_rows(raw_rows, connector)

    logger.info(
        "Google Ads fetch done: customer_id=%s rows=%d connector=%s",
        customer_id, len(docs), connector.get("_id"),
    )
    return docs
