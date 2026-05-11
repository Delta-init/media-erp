"""
LinkedIn Ads data fetcher — Phase 3.8.

Fetches the last 30 days of campaign-level daily performance metrics
via the LinkedIn Marketing REST API (versioned, 202406).

API overview
------------
  Base URL    : https://api.linkedin.com/rest
  Auth        : Bearer token
  Headers     : LinkedIn-Version: 202406
                X-Restli-Protocol-Version: 2.0.0

Connector field used  : platform_account_id → numeric sponsored account ID
                        (auto-discovered via /adAccounts on first sync)

Data mapping
------------
  date          → dateRange.start   (YYYY-MM-DD, DAILY granularity)
  campaign_id   → pivot URN numeric ID from "urn:li:sponsoredCampaign:{id}"
  campaign_name → looked up from /adCampaigns cache
  impressions   → impressions
  clicks        → clicks
  spend         → costInLocalCurrency   (string → float)
  conversions   → externalWebsiteConversions
  revenue       → conversionValueInLocalCurrency  (string → float)
  device        → None  (not available at campaign level)
  currency      → account currency

Registration
------------
    PLATFORM_FETCH_REGISTRY["linkedin_ads"] = fetch_data
    Called from sync_service._register_platforms() at module load.
"""

import logging
from datetime import datetime, date, timezone, timedelta
from typing import Optional

import httpx

from app.config import settings
from app.database import get_sync_db
from app.models.marketing_data import marketing_data_doc, compute_derived_metrics

logger = logging.getLogger(__name__)

_BASE_URL       = "https://api.linkedin.com/rest"
_TOKEN_URL      = "https://www.linkedin.com/oauth/v2/accessToken"
_API_VERSION    = "202406"

_COMMON_HEADERS = {
    "LinkedIn-Version":            _API_VERSION,
    "X-Restli-Protocol-Version":   "2.0.0",
}

# Refresh access token when within this many days of expiry
_REFRESH_BEFORE_DAYS = 5


# ── Token helpers ──────────────────────────────────────────────────────────────

def _refresh_linkedin_token(refresh_token: str) -> tuple[str, datetime]:
    """Exchange a refresh token for a new access token (synchronous)."""
    with httpx.Client(timeout=30) as client:
        resp = client.post(
            _TOKEN_URL,
            data={
                "grant_type":    "refresh_token",
                "refresh_token": refresh_token,
                "client_id":     settings.linkedin_client_id,
                "client_secret": settings.linkedin_client_secret,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
    if resp.status_code != 200:
        raise RuntimeError(f"LinkedIn token refresh failed ({resp.status_code}): {resp.text}")
    data = resp.json()
    expires_in = data.get("expires_in", 5_183_944)
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
    return data["access_token"], expires_at


def _get_valid_token(connector: dict, tokens: dict) -> str:
    """
    Return a valid access token, auto-refreshing if within 5 days of expiry.
    Persists the new encrypted token to MongoDB on refresh.
    """
    expires_at: Optional[datetime] = connector.get("token_expires_at")
    now = datetime.now(timezone.utc)

    if expires_at:
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at > now + timedelta(days=_REFRESH_BEFORE_DAYS):
            return tokens["access_token"]

    refresh_token = tokens.get("refresh_token")
    if not refresh_token:
        logger.warning("No refresh token available; using potentially expired access token")
        return tokens["access_token"]

    logger.info("Refreshing LinkedIn access token for connector %s", connector.get("_id"))
    new_token, new_expires = _refresh_linkedin_token(refresh_token)

    from app.utils.encryption import encrypt
    get_sync_db()["connectors"].update_one(
        {"_id": connector["_id"]},
        {"$set": {
            "encrypted_access_token": encrypt(new_token),
            "token_expires_at":       new_expires,
            "updated_at":             now,
        }},
    )
    return new_token


def _auth_headers(access_token: str) -> dict:
    return {**_COMMON_HEADERS, "Authorization": f"Bearer {access_token}"}


# ── Ad Account resolution ──────────────────────────────────────────────────────

def _list_ad_accounts(access_token: str) -> list[dict]:
    """Return all sponsored accounts accessible with this token."""
    with httpx.Client(timeout=30) as client:
        resp = client.get(
            f"{_BASE_URL}/adAccounts",
            headers=_auth_headers(access_token),
            params={
                "q":      "search",
                "count":  100,
                "fields": "id,name,currency,status",
            },
        )
    if resp.status_code == 401:
        raise RuntimeError("LinkedIn API: 401 Unauthorized — token expired or revoked")
    if resp.status_code != 200:
        raise RuntimeError(f"LinkedIn /adAccounts failed ({resp.status_code}): {resp.text}")
    return resp.json().get("elements", [])


def _resolve_account_id(connector: dict, access_token: str) -> tuple[str, str]:
    """
    Return (account_id, currency) to sync.
    Uses platform_account_id if stored, otherwise discovers the first active account.
    """
    stored = connector.get("platform_account_id")
    if stored:
        return stored, "USD"   # currency fetched later during analytics call if needed

    accounts = _list_ad_accounts(access_token)
    if not accounts:
        raise RuntimeError("No LinkedIn Ad Accounts found for this token")

    # Prefer active accounts; fall back to first
    active = [a for a in accounts if a.get("status") == "ACTIVE"]
    chosen = active[0] if active else accounts[0]
    account_id = str(chosen["id"])
    currency   = chosen.get("currency", "USD")

    logger.info(
        "Discovered LinkedIn account_id=%s for connector %s",
        account_id, connector.get("_id"),
    )
    get_sync_db()["connectors"].update_one(
        {"_id": connector["_id"]},
        {"$set": {
            "platform_account_id": account_id,
            "updated_at": datetime.now(timezone.utc),
        }},
    )
    return account_id, currency


# ── Campaign name lookup ───────────────────────────────────────────────────────

def _build_campaign_name_map(account_id: str, access_token: str) -> dict[str, str]:
    """
    Return {campaign_id_str: campaign_name} for all campaigns in the account.
    Used to enrich analytics rows that only carry URNs.
    """
    name_map: dict[str, str] = {}
    account_urn = f"urn:li:sponsoredAccount:{account_id}"
    start = 0
    count = 100

    with httpx.Client(timeout=30) as client:
        while True:
            resp = client.get(
                f"{_BASE_URL}/adCampaigns",
                headers=_auth_headers(access_token),
                params={
                    "q":        "search",
                    "search.account.values[0]": account_urn,
                    "fields":   "id,name",
                    "count":    count,
                    "start":    start,
                },
            )
            if resp.status_code != 200:
                logger.warning("LinkedIn /adCampaigns failed (%d): %s", resp.status_code, resp.text)
                break

            data = resp.json()
            elements = data.get("elements", [])
            for el in elements:
                name_map[str(el["id"])] = el.get("name", "")

            paging = data.get("paging", {})
            start += count
            if start >= paging.get("total", 0) or not elements:
                break

    return name_map


# ── Analytics API ──────────────────────────────────────────────────────────────

def _fetch_analytics(account_id: str, access_token: str) -> list[dict]:
    """
    Fetch daily campaign-level analytics for the last 30 days.
    LinkedIn /adAnalytics with pivot=CAMPAIGN and DAILY granularity.
    Handles pagination.
    """
    today      = date.today()
    end_date   = today - timedelta(days=1)
    start_date = end_date - timedelta(days=29)

    base_params = {
        "q":                       "analytics",
        "pivot":                   "CAMPAIGN",
        "timeGranularity":         "DAILY",
        "dateRange.start.year":    start_date.year,
        "dateRange.start.month":   start_date.month,
        "dateRange.start.day":     start_date.day,
        "dateRange.end.year":      end_date.year,
        "dateRange.end.month":     end_date.month,
        "dateRange.end.day":       end_date.day,
        "accounts[0]":             f"urn:li:sponsoredAccount:{account_id}",
        "fields": ",".join([
            "impressions",
            "clicks",
            "costInLocalCurrency",
            "externalWebsiteConversions",
            "conversionValueInLocalCurrency",
            "dateRange",
            "pivotValue",
        ]),
        "count": 500,
    }

    all_elements: list[dict] = []
    start = 0

    with httpx.Client(timeout=60) as client:
        while True:
            params = {**base_params, "start": start}
            resp = client.get(
                f"{_BASE_URL}/adAnalytics",
                headers=_auth_headers(access_token),
                params=params,
            )

            if resp.status_code == 401:
                raise RuntimeError("LinkedIn API: 401 Unauthorized")
            if resp.status_code != 200:
                raise RuntimeError(
                    f"LinkedIn /adAnalytics error {resp.status_code}: {resp.text}"
                )

            data = resp.json()
            elements = data.get("elements", [])
            all_elements.extend(elements)

            paging = data.get("paging", {})
            total  = paging.get("total", 0)
            start += 500
            if start >= total or not elements:
                break

    return all_elements


# ── Row parsing ────────────────────────────────────────────────────────────────

def _urn_to_id(urn: str) -> str:
    """'urn:li:sponsoredCampaign:123456' → '123456'"""
    parts = urn.rsplit(":", 1)
    return parts[-1] if len(parts) == 2 else urn


def _parse_date(date_range: dict) -> str:
    """Convert LinkedIn dateRange.start dict → 'YYYY-MM-DD' string."""
    s = date_range.get("start", {})
    try:
        return f"{s['year']:04d}-{s['month']:02d}-{s['day']:02d}"
    except (KeyError, TypeError):
        return ""


def _parse_elements(
    elements: list[dict],
    connector: dict,
    account_id: str,
    currency: str,
    campaign_names: dict[str, str],
) -> list[dict]:
    """Convert raw LinkedIn analytics elements into marketing_data_doc dicts."""
    user_id      = connector["user_id"]
    connector_id = str(connector["_id"])
    docs: list[dict] = []

    for el in elements:
        pivot_urn   = el.get("pivotValue", "")
        campaign_id = _urn_to_id(pivot_urn)
        date_str    = _parse_date(el.get("dateRange", {}))

        if not campaign_id or not date_str:
            continue

        campaign_name = campaign_names.get(campaign_id, f"Campaign {campaign_id}")

        impressions = int(el.get("impressions", 0) or 0)
        clicks      = int(el.get("clicks",      0) or 0)
        spend       = float(el.get("costInLocalCurrency",          "0") or 0)
        conversions = int(float(el.get("externalWebsiteConversions", 0) or 0))
        revenue     = float(el.get("conversionValueInLocalCurrency", "0") or 0)

        derived = compute_derived_metrics(impressions, clicks, spend, revenue)

        docs.append(marketing_data_doc(
            user_id=user_id,
            connector_id=connector_id,
            platform="linkedin_ads",
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
            device=None,
            currency=currency,
        ))

    return docs


# ── Public entry point ─────────────────────────────────────────────────────────

def fetch_data(connector: dict, tokens: dict) -> list[dict]:
    """
    Fetch LinkedIn Ads campaign metrics for the last 30 days.

    Called by sync_service.run_sync() via PLATFORM_FETCH_REGISTRY["linkedin_ads"].

    Args:
        connector : MongoDB connector document (plain dict from PyMongo)
        tokens    : {"access_token": str, "refresh_token": str | None}
                    (already decrypted by sync_service)

    Returns:
        List of marketing_data_doc-shaped dicts ready for bulk upsert.
    """
    access_token          = _get_valid_token(connector, tokens)
    account_id, currency  = _resolve_account_id(connector, access_token)

    logger.info(
        "LinkedIn Ads fetch start: account_id=%s connector=%s",
        account_id, connector.get("_id"),
    )

    # Build campaign name map first (single API call for all campaigns)
    campaign_names = _build_campaign_name_map(account_id, access_token)
    logger.debug("LinkedIn campaign map: %d entries", len(campaign_names))

    elements = _fetch_analytics(account_id, access_token)
    docs     = _parse_elements(elements, connector, account_id, currency, campaign_names)

    logger.info(
        "LinkedIn Ads fetch done: account_id=%s rows=%d connector=%s",
        account_id, len(docs), connector.get("_id"),
    )
    return docs
