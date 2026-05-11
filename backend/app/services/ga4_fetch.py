"""
GA4 data fetcher — Phase 3.5.

Fetches the last 30 days of traffic + conversion metrics from the
Google Analytics Data API v1beta, normalised into marketing_data_doc format.

Connector field used   : platform_account_id → GA4 numeric property ID
                         (auto-discovered on first sync via Admin API if not set)

Schema mapping (GA4 has no ad-spend concept)
--------------------------------------------
  date          → date dimension       (YYYYMMDD → YYYY-MM-DD)
  campaign_id   → SHA-1[:16] of (property_id|date|campaign|source|medium)
  campaign_name → "{sessionCampaignName} / {source} / {medium}"
  impressions   → screenPageViews      (pageview reach proxy)
  clicks        → sessions             (traffic proxy)
  spend         → 0.0                  (not available in GA4)
  conversions   → conversions          (goal completions)
  revenue       → purchaseRevenue
  device        → deviceCategory       (desktop / mobile / tablet)

Registration
------------
    PLATFORM_FETCH_REGISTRY["ga4"] = fetch_data
    Called from sync_service._register_platforms() at module load.
"""

import hashlib
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

import httpx

from app.config import settings
from app.database import get_sync_db
from app.models.marketing_data import marketing_data_doc, compute_derived_metrics

logger = logging.getLogger(__name__)

_DATA_API  = "https://analyticsdata.googleapis.com/v1beta"
_ADMIN_API = "https://analyticsadmin.googleapis.com/v1beta"
_TOKEN_URL = "https://oauth2.googleapis.com/token"


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
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at > now + timedelta(minutes=5):
            return tokens["access_token"]

    refresh_token = tokens.get("refresh_token")
    if not refresh_token:
        logger.warning("No refresh token available; using potentially expired access token")
        return tokens["access_token"]

    logger.info("Refreshing GA4 access token for connector %s", connector.get("_id"))
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


# ── Property ID resolution ─────────────────────────────────────────────────────

def _discover_property_id(access_token: str) -> str:
    """
    Discover the first GA4 property accessible with this token via the Admin API.
    Returns the numeric property ID string (e.g. "123456789").
    """
    headers = {"Authorization": f"Bearer {access_token}"}

    with httpx.Client(timeout=30) as client:
        # 1. List accounts
        resp = client.get(f"{_ADMIN_API}/accounts", headers=headers)
        if resp.status_code != 200:
            raise RuntimeError(
                f"GA4 Admin API (accounts) failed ({resp.status_code}): {resp.text}"
            )
        accounts = resp.json().get("accounts", [])
        if not accounts:
            raise RuntimeError("No GA4 accounts found for this token")

        # 2. List properties under the first account
        account_name = accounts[0]["name"]   # "accounts/123456"
        resp = client.get(
            f"{_ADMIN_API}/properties",
            headers=headers,
            params={"filter": f"parent:{account_name}"},
        )
        if resp.status_code != 200:
            raise RuntimeError(
                f"GA4 Admin API (properties) failed ({resp.status_code}): {resp.text}"
            )
        properties = resp.json().get("properties", [])
        if not properties:
            raise RuntimeError(
                f"No GA4 properties found under {account_name}"
            )

        # "properties/123456789" → "123456789"
        prop_name = properties[0]["name"]
        return prop_name.split("/")[1]


def _resolve_property_id(connector: dict, access_token: str) -> str:
    """
    Return the GA4 property ID to sync, discovering it from the Admin API
    if platform_account_id is not set on the connector.
    """
    stored_id = connector.get("platform_account_id")
    if stored_id:
        return stored_id

    property_id = _discover_property_id(access_token)
    logger.info(
        "Discovered GA4 property_id=%s for connector %s",
        property_id, connector.get("_id"),
    )
    get_sync_db()["connectors"].update_one(
        {"_id": connector["_id"]},
        {"$set": {
            "platform_account_id": property_id,
            "updated_at": datetime.now(timezone.utc),
        }},
    )
    return property_id


# ── Analytics Data API ─────────────────────────────────────────────────────────

def _run_report(property_id: str, access_token: str) -> dict:
    """
    Call the GA4 Data API runReport endpoint and handle pagination.
    Returns a merged response dict with all rows.
    """
    url = f"{_DATA_API}/properties/{property_id}:runReport"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }
    base_payload = {
        "dateRanges": [{"startDate": "30daysAgo", "endDate": "yesterday"}],
        "dimensions": [
            {"name": "date"},
            {"name": "sessionCampaignName"},
            {"name": "sessionSource"},
            {"name": "sessionMedium"},
            {"name": "deviceCategory"},
        ],
        "metrics": [
            {"name": "sessions"},
            {"name": "screenPageViews"},
            {"name": "conversions"},
            {"name": "purchaseRevenue"},
            {"name": "totalUsers"},
        ],
        "orderBys": [{"dimension": {"dimensionName": "date"}, "desc": True}],
        "keepEmptyRows": False,
    }

    limit = 10000
    offset = 0
    all_rows: list[dict] = []
    dim_headers: list[dict] = []
    met_headers: list[dict] = []

    with httpx.Client(timeout=60) as client:
        while True:
            payload = {**base_payload, "limit": limit, "offset": offset}
            resp = client.post(url, headers=headers, json=payload)

            if resp.status_code == 401:
                raise RuntimeError("GA4 API: 401 Unauthorized — token expired or revoked")
            if resp.status_code != 200:
                raise RuntimeError(f"GA4 API error {resp.status_code}: {resp.text}")

            data = resp.json()

            if not dim_headers:
                dim_headers = data.get("dimensionHeaders", [])
                met_headers = data.get("metricHeaders", [])

            rows = data.get("rows", [])
            all_rows.extend(rows)

            row_count = data.get("rowCount", 0)
            offset += limit
            if offset >= row_count or not rows:
                break

    return {
        "dimensionHeaders": dim_headers,
        "metricHeaders": met_headers,
        "rows": all_rows,
    }


# ── Row parsing ────────────────────────────────────────────────────────────────

def _parse_report(report: dict, connector: dict, property_id: str) -> list[dict]:
    """Convert a GA4 runReport response into marketing_data_doc-shaped dicts."""
    rows = report.get("rows", [])
    if not rows:
        return []

    dim_names = [h["name"] for h in report.get("dimensionHeaders", [])]
    met_names = [h["name"] for h in report.get("metricHeaders", [])]

    user_id      = connector["user_id"]
    connector_id = str(connector["_id"])

    def get_dim(row: dict, name: str) -> str:
        try:
            return row["dimensionValues"][dim_names.index(name)]["value"]
        except (ValueError, IndexError, KeyError):
            return ""

    def get_met(row: dict, name: str, cast=float):
        try:
            return cast(row["metricValues"][met_names.index(name)]["value"])
        except (ValueError, IndexError, KeyError):
            return cast(0)

    docs: list[dict] = []
    for row in rows:
        # Date: GA4 returns "YYYYMMDD" → convert to "YYYY-MM-DD"
        date_raw = get_dim(row, "date")
        if len(date_raw) == 8:
            date_str = f"{date_raw[:4]}-{date_raw[4:6]}-{date_raw[6:]}"
        else:
            date_str = date_raw

        campaign_name = get_dim(row, "sessionCampaignName") or "(not set)"
        source        = get_dim(row, "sessionSource")       or "(direct)"
        medium        = get_dim(row, "sessionMedium")       or "(none)"
        device_raw    = get_dim(row, "deviceCategory")
        device        = device_raw.lower() if device_raw else None

        # Stable, deterministic campaign_id for this unique traffic segment
        raw_id = f"{property_id}|{date_str}|{campaign_name}|{source}|{medium}"
        campaign_id = hashlib.sha1(raw_id.encode()).hexdigest()[:16]

        full_campaign_name = f"{campaign_name} / {source} / {medium}"

        sessions   = get_met(row, "sessions", int)
        pageviews  = get_met(row, "screenPageViews", int)
        conversions = get_met(row, "conversions", int)
        revenue    = get_met(row, "purchaseRevenue", float)

        # GA4 schema → marketing_data_doc mapping:
        #   impressions  = screenPageViews (reach proxy)
        #   clicks       = sessions        (traffic proxy)
        #   spend        = 0.0             (GA4 has no spend data)
        derived = compute_derived_metrics(
            impressions=pageviews,
            clicks=sessions,
            spend=0.0,
            revenue=revenue,
        )

        docs.append(marketing_data_doc(
            user_id=user_id,
            connector_id=connector_id,
            platform="ga4",
            date=date_str,
            account_id=property_id,
            campaign_id=campaign_id,
            campaign_name=full_campaign_name,
            impressions=pageviews,
            clicks=sessions,
            spend=0.0,
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
    Fetch GA4 traffic + conversion metrics for the last 30 days.

    Called by sync_service.run_sync() via PLATFORM_FETCH_REGISTRY["ga4"].

    Args:
        connector : MongoDB connector document (plain dict from PyMongo)
        tokens    : {"access_token": str, "refresh_token": str | None}
                    (already decrypted by sync_service)

    Returns:
        List of marketing_data_doc-shaped dicts ready for bulk upsert.
    """
    access_token = _get_valid_token(connector, tokens)
    property_id  = _resolve_property_id(connector, access_token)

    logger.info(
        "GA4 fetch start: property_id=%s connector=%s",
        property_id, connector.get("_id"),
    )

    report = _run_report(property_id, access_token)
    docs   = _parse_report(report, connector, property_id)

    logger.info(
        "GA4 fetch done: property_id=%s rows=%d connector=%s",
        property_id, len(docs), connector.get("_id"),
    )
    return docs
