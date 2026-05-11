"""
Facebook Ads data fetcher — Phase 3.6.

Fetches the last 30 days of campaign-level daily performance metrics
via the Facebook Marketing API v21.0 (/insights endpoint).

Token model
-----------
  Facebook issues long-lived tokens (~60 days).  Both access_token and
  refresh_token are stored as the same long-lived token in the connector.
  Re-extension uses the fb_exchange_token grant at ≤7 days before expiry.

Connector field used  : platform_account_id → numeric ad account ID
                        (auto-discovered on first sync via /me/adaccounts)

Data mapping
------------
  date          → date_start    (YYYY-MM-DD, 1-day time_increment)
  campaign_id   → campaign_id
  campaign_name → campaign_name
  impressions   → impressions   (string → int)
  clicks        → clicks        (string → int)
  spend         → spend         (string USD float)
  conversions   → actions[action_type=purchase].value
  revenue       → action_values[action_type=purchase].value
  device        → None          (not segmented at campaign level)
  currency      → account_currency

Registration
------------
    PLATFORM_FETCH_REGISTRY["facebook_ads"] = fetch_data
    Called from sync_service._register_platforms() at module load.
"""

import json
import logging
from datetime import datetime, date, timezone, timedelta
from typing import Optional

import httpx

from app.config import settings
from app.database import get_sync_db
from app.models.marketing_data import marketing_data_doc, compute_derived_metrics

logger = logging.getLogger(__name__)

_GRAPH_VERSION = "v21.0"
_GRAPH_BASE    = f"https://graph.facebook.com/{_GRAPH_VERSION}"
_TOKEN_URL     = f"{_GRAPH_BASE}/oauth/access_token"

# Refresh the long-lived token when within this many days of expiry
_REFRESH_BEFORE_DAYS = 7

# Insights fields to request
_INSIGHT_FIELDS = ",".join([
    "campaign_id",
    "campaign_name",
    "impressions",
    "clicks",
    "spend",
    "actions",
    "action_values",
    "account_id",
    "account_currency",
])


# ── Token helpers ──────────────────────────────────────────────────────────────

def _extend_token(long_lived_token: str) -> tuple[str, datetime]:
    """
    Re-extend a Facebook long-lived token via the fb_exchange_token grant.
    Returns (new_token, new_expires_at).
    """
    with httpx.Client(timeout=30) as client:
        resp = client.get(
            _TOKEN_URL,
            params={
                "grant_type":        "fb_exchange_token",
                "client_id":         settings.facebook_app_id,
                "client_secret":     settings.facebook_app_secret,
                "fb_exchange_token": long_lived_token,
            },
        )
    if resp.status_code != 200:
        raise RuntimeError(f"Facebook token refresh failed ({resp.status_code}): {resp.text}")
    data = resp.json()
    expires_in  = data.get("expires_in", 60 * 86_400)   # default 60 days
    expires_at  = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
    return data["access_token"], expires_at


def _get_valid_token(connector: dict, tokens: dict) -> str:
    """
    Return a valid access token, extending it if within 7 days of expiry.
    Updates the connector in MongoDB when a refresh occurs.
    """
    expires_at: Optional[datetime] = connector.get("token_expires_at")
    now = datetime.now(timezone.utc)

    if expires_at:
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        cutoff = now + timedelta(days=_REFRESH_BEFORE_DAYS)
        if expires_at > cutoff:
            return tokens["access_token"]  # still has headroom

    # Use the stored token (same as refresh_token for Facebook)
    current_token = tokens.get("access_token") or tokens.get("refresh_token")
    if not current_token:
        raise RuntimeError("No Facebook access token available")

    logger.info("Extending Facebook long-lived token for connector %s", connector.get("_id"))
    new_token, new_expires = _extend_token(current_token)

    from app.utils.encryption import encrypt
    get_sync_db()["connectors"].update_one(
        {"_id": connector["_id"]},
        {"$set": {
            "encrypted_access_token":  encrypt(new_token),
            "encrypted_refresh_token": encrypt(new_token),   # stays identical
            "token_expires_at":        new_expires,
            "updated_at":              now,
        }},
    )
    return new_token


# ── Ad Account resolution ──────────────────────────────────────────────────────

def _list_ad_accounts(access_token: str) -> list[dict]:
    """Return all ad accounts accessible with this token."""
    with httpx.Client(timeout=30) as client:
        resp = client.get(
            f"{_GRAPH_BASE}/me/adaccounts",
            params={
                "fields":       "id,name,currency",
                "access_token": access_token,
                "limit":        200,
            },
        )
    if resp.status_code != 200:
        raise RuntimeError(f"Facebook /me/adaccounts failed ({resp.status_code}): {resp.text}")
    return resp.json().get("data", [])


def _resolve_ad_account_id(connector: dict, access_token: str) -> str:
    """
    Return the numeric ad account ID (without 'act_' prefix).
    If platform_account_id is already stored, use it.
    Otherwise discover and persist the first accessible ad account.
    """
    stored = connector.get("platform_account_id")
    if stored:
        return stored.replace("act_", "")   # normalise just in case

    accounts = _list_ad_accounts(access_token)
    if not accounts:
        raise RuntimeError("No Facebook Ad Accounts found for this token")

    # accounts[0]["id"] is already "act_NNNNN"
    raw_id     = accounts[0]["id"]                 # "act_123456789"
    account_id = raw_id.replace("act_", "")        # "123456789"

    logger.info(
        "Discovered Facebook ad_account_id=%s for connector %s",
        account_id, connector.get("_id"),
    )
    get_sync_db()["connectors"].update_one(
        {"_id": connector["_id"]},
        {"$set": {
            "platform_account_id": account_id,
            "updated_at": datetime.now(timezone.utc),
        }},
    )
    return account_id


# ── Marketing API — Insights ───────────────────────────────────────────────────

def _fetch_insights(account_id: str, access_token: str) -> list[dict]:
    """
    Fetch campaign-level daily insights for the last 30 days.
    Handles cursor-based pagination automatically.
    """
    today = date.today()
    since = (today - timedelta(days=30)).isoformat()
    until = (today - timedelta(days=1)).isoformat()

    url = f"{_GRAPH_BASE}/act_{account_id}/insights"
    base_params = {
        "access_token":    access_token,
        "fields":          _INSIGHT_FIELDS,
        "level":           "campaign",
        "time_increment":  "1",          # daily breakdown
        "time_range":      json.dumps({"since": since, "until": until}),
        "limit":           500,
    }

    all_rows: list[dict] = []

    with httpx.Client(timeout=60) as client:
        params = dict(base_params)
        while True:
            resp = client.get(url, params=params)

            if resp.status_code == 401:
                raise RuntimeError("Facebook API: 401 Unauthorized — token expired or revoked")
            if resp.status_code != 200:
                raise RuntimeError(f"Facebook Insights API error {resp.status_code}: {resp.text}")

            data = resp.json()
            all_rows.extend(data.get("data", []))

            # Cursor-based pagination
            next_url = data.get("paging", {}).get("next")
            if not next_url:
                break

            # The 'next' URL is fully qualified; use it directly
            resp = client.get(next_url)
            if resp.status_code != 200:
                break
            data = resp.json()
            all_rows.extend(data.get("data", []))

            next_url = data.get("paging", {}).get("next")
            if not next_url:
                break
            # Re-enter loop using next cursor
            after = data["paging"]["cursors"]["after"]
            params = {**base_params, "after": after}

    return all_rows


# ── Row parsing ────────────────────────────────────────────────────────────────

def _extract_action_value(action_list: list[dict], action_type: str) -> float:
    """Sum values for a given action_type across all matching action dicts."""
    total = 0.0
    for item in action_list:
        if item.get("action_type") == action_type:
            try:
                total += float(item.get("value", 0))
            except (TypeError, ValueError):
                pass
    return total


def _parse_rows(rows: list[dict], connector: dict) -> list[dict]:
    """Convert raw Facebook Insights rows into marketing_data_doc-shaped dicts."""
    user_id      = connector["user_id"]
    connector_id = str(connector["_id"])

    docs: list[dict] = []
    for row in rows:
        campaign_id   = str(row.get("campaign_id", ""))
        campaign_name = row.get("campaign_name", "")
        date_str      = row.get("date_start", "")   # "YYYY-MM-DD"
        account_id    = str(row.get("account_id", ""))
        currency      = row.get("account_currency", "USD")

        impressions = int(row.get("impressions", 0) or 0)
        clicks      = int(row.get("clicks",      0) or 0)
        spend       = float(row.get("spend",     0) or 0)

        actions       = row.get("actions",       []) or []
        action_values = row.get("action_values", []) or []

        conversions = int(_extract_action_value(actions,       "purchase"))
        revenue     = _extract_action_value(action_values, "purchase")

        derived = compute_derived_metrics(impressions, clicks, spend, revenue)

        docs.append(marketing_data_doc(
            user_id=user_id,
            connector_id=connector_id,
            platform="facebook_ads",
            date=date_str,
            account_id=account_id,
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
            device=None,        # not segmented at campaign level
            currency=currency,
        ))

    return docs


# ── Public entry point ─────────────────────────────────────────────────────────

def fetch_data(connector: dict, tokens: dict) -> list[dict]:
    """
    Fetch Facebook Ads campaign metrics for the last 30 days.

    Called by sync_service.run_sync() via PLATFORM_FETCH_REGISTRY["facebook_ads"].

    Args:
        connector : MongoDB connector document (plain dict from PyMongo)
        tokens    : {"access_token": str, "refresh_token": str | None}
                    (already decrypted by sync_service)

    Returns:
        List of marketing_data_doc-shaped dicts ready for bulk upsert.
    """
    access_token = _get_valid_token(connector, tokens)
    account_id   = _resolve_ad_account_id(connector, access_token)

    logger.info(
        "Facebook Ads fetch start: account_id=%s connector=%s",
        account_id, connector.get("_id"),
    )

    raw_rows = _fetch_insights(account_id, access_token)
    docs     = _parse_rows(raw_rows, connector)

    logger.info(
        "Facebook Ads fetch done: account_id=%s rows=%d connector=%s",
        account_id, len(docs), connector.get("_id"),
    )
    return docs
