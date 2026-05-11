"""
TikTok Ads data fetcher — Phase 3.9.

Fetches the last 30 days of campaign-level daily performance metrics
via the TikTok Marketing API v1.3 (/report/integrated/get/).

Token model
-----------
  TikTok access tokens are long-lived (no refresh needed).
  The token is passed as the `Access-Token` header on every request.

Connector field used  : platform_account_id → numeric advertiser ID
                        (stored from token exchange; or discovered via
                        /oauth2/advertiser/get/ on first sync)

Data mapping
------------
  date          → dimensions.stat_time_day[:10]   ("YYYY-MM-DD HH:MM:SS" → "YYYY-MM-DD")
  campaign_id   → dimensions.campaign_id
  campaign_name → metrics.campaign_name
  impressions   → metrics.impressions    (string → int)
  clicks        → metrics.clicks         (string → int)
  spend         → metrics.spend          (string → float, already in account currency)
  conversions   → metrics.conversions    (string → int)
  revenue       → metrics.total_purchase_value  (string → float)
  device        → None   (not segmented at campaign level in this report)
  currency      → account currency (from /advertiser/info/)

Registration
------------
    PLATFORM_FETCH_REGISTRY["tiktok_ads"] = fetch_data
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

_BASE_URL = "https://business-api.tiktok.com/open_api/v1.3"

# Report metrics to fetch
_METRICS = [
    "campaign_name",
    "impressions",
    "clicks",
    "spend",
    "conversions",
    "total_purchase_value",
]


# ── Auth header ────────────────────────────────────────────────────────────────

def _headers(access_token: str) -> dict:
    return {
        "Access-Token": access_token,
        "Content-Type": "application/json",
    }


# ── Advertiser ID resolution ───────────────────────────────────────────────────

def _list_advertisers(access_token: str) -> list[dict]:
    """Return advertiser accounts accessible with this token."""
    with httpx.Client(timeout=30) as client:
        resp = client.get(
            f"{_BASE_URL}/oauth2/advertiser/get/",
            headers=_headers(access_token),
            params={
                "app_id": settings.tiktok_app_id,
                "secret": settings.tiktok_app_secret,
            },
        )
    if resp.status_code != 200:
        raise RuntimeError(f"TikTok /advertiser/get/ HTTP error ({resp.status_code}): {resp.text}")
    body = resp.json()
    if body.get("code") != 0:
        raise RuntimeError(f"TikTok /advertiser/get/ API error: {body.get('message', body)}")
    return body.get("data", {}).get("list", [])


def _resolve_advertiser_id(connector: dict, access_token: str) -> str:
    """
    Return the advertiser ID to sync.
    Uses platform_account_id if stored; otherwise discovers the first account.
    """
    stored = connector.get("platform_account_id")
    if stored:
        return stored

    advertisers = _list_advertisers(access_token)
    if not advertisers:
        raise RuntimeError("No TikTok advertiser accounts found for this token")

    advertiser_id = str(advertisers[0]["advertiser_id"])
    logger.info(
        "Discovered TikTok advertiser_id=%s for connector %s",
        advertiser_id, connector.get("_id"),
    )
    get_sync_db()["connectors"].update_one(
        {"_id": connector["_id"]},
        {"$set": {
            "platform_account_id": advertiser_id,
            "updated_at": datetime.now(timezone.utc),
        }},
    )
    return advertiser_id


# ── Report API ─────────────────────────────────────────────────────────────────

def _fetch_report(advertiser_id: str, access_token: str) -> list[dict]:
    """
    Fetch daily campaign-level report for the last 30 days.
    Handles pagination via page / page_size.
    """
    today      = date.today()
    end_date   = (today - timedelta(days=1)).isoformat()
    start_date = (today - timedelta(days=30)).isoformat()

    all_rows: list[dict] = []
    page      = 1
    page_size = 1000

    with httpx.Client(timeout=60) as client:
        while True:
            payload = {
                "advertiser_id": advertiser_id,
                "report_type":   "BASIC",
                "data_level":    "AUCTION_CAMPAIGN",
                "dimensions":    ["campaign_id", "stat_time_day"],
                "metrics":       _METRICS,
                "start_date":    start_date,
                "end_date":      end_date,
                "order_field":   "stat_time_day",
                "order_type":    "DESC",
                "page":          page,
                "page_size":     page_size,
            }

            resp = client.post(
                f"{_BASE_URL}/report/integrated/get/",
                headers=_headers(access_token),
                json=payload,
            )

            if resp.status_code == 401:
                raise RuntimeError("TikTok API: 401 Unauthorized — token revoked")
            if resp.status_code != 200:
                raise RuntimeError(f"TikTok report API error {resp.status_code}: {resp.text}")

            body = resp.json()
            if body.get("code") != 0:
                raise RuntimeError(f"TikTok report API error: {body.get('message', body)}")

            data      = body.get("data", {})
            rows      = data.get("list", [])
            page_info = data.get("page_info", {})

            all_rows.extend(rows)

            total_page = page_info.get("total_page", 1)
            if page >= total_page or not rows:
                break
            page += 1

    return all_rows


# ── Row parsing ────────────────────────────────────────────────────────────────

def _parse_rows(rows: list[dict], connector: dict, advertiser_id: str) -> list[dict]:
    """Convert raw TikTok report rows into marketing_data_doc-shaped dicts."""
    user_id      = connector["user_id"]
    connector_id = str(connector["_id"])
    docs: list[dict] = []

    for row in rows:
        dims    = row.get("dimensions", {})
        metrics = row.get("metrics", {})

        campaign_id = str(dims.get("campaign_id", ""))
        # "2024-01-15 00:00:00" → "2024-01-15"
        stat_time   = dims.get("stat_time_day", "")
        date_str    = stat_time[:10] if stat_time else ""

        if not campaign_id or not date_str:
            continue

        campaign_name = metrics.get("campaign_name", f"Campaign {campaign_id}")

        impressions = int(metrics.get("impressions",          "0") or 0)
        clicks      = int(metrics.get("clicks",               "0") or 0)
        spend       = float(metrics.get("spend",              "0") or 0)
        conversions = int(float(metrics.get("conversions",    "0") or 0))
        revenue     = float(metrics.get("total_purchase_value","0") or 0)

        derived = compute_derived_metrics(impressions, clicks, spend, revenue)

        docs.append(marketing_data_doc(
            user_id=user_id,
            connector_id=connector_id,
            platform="tiktok_ads",
            date=date_str,
            account_id=advertiser_id,
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
            currency="USD",
        ))

    return docs


# ── Public entry point ─────────────────────────────────────────────────────────

def fetch_data(connector: dict, tokens: dict) -> list[dict]:
    """
    Fetch TikTok Ads campaign metrics for the last 30 days.

    Called by sync_service.run_sync() via PLATFORM_FETCH_REGISTRY["tiktok_ads"].

    Args:
        connector : MongoDB connector document (plain dict from PyMongo)
        tokens    : {"access_token": str, "refresh_token": None}
                    (already decrypted by sync_service; TikTok has no refresh)

    Returns:
        List of marketing_data_doc-shaped dicts ready for bulk upsert.
    """
    access_token  = tokens["access_token"]
    advertiser_id = _resolve_advertiser_id(connector, access_token)

    logger.info(
        "TikTok Ads fetch start: advertiser_id=%s connector=%s",
        advertiser_id, connector.get("_id"),
    )

    raw_rows = _fetch_report(advertiser_id, access_token)
    docs     = _parse_rows(raw_rows, connector, advertiser_id)

    logger.info(
        "TikTok Ads fetch done: advertiser_id=%s rows=%d connector=%s",
        advertiser_id, len(docs), connector.get("_id"),
    )
    return docs
