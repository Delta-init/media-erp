"""
Instagram Login insights fetcher.
Fetches daily page-level metrics (impressions, reach, follower count snapshots)
for instagram_login connectors.

API: GET https://graph.instagram.com/v21.0/{ig_user_id}/insights
Metrics: impressions, reach (period=day)
Follower snapshot: GET /me?fields=followers_count

Registration: PLATFORM_FETCH_REGISTRY["instagram_login"] = fetch_data
"""
import logging
from datetime import date, datetime, timedelta

import httpx

from app.models.marketing_data import marketing_data_doc

logger = logging.getLogger(__name__)

_API_BASE = "https://graph.instagram.com/v21.0"


def fetch_data(connector: dict, tokens: dict) -> list[dict]:
    """
    Fetch Instagram page insights for last 30 days.
    Returns marketing_data_doc-shaped records.
    """
    access_token = tokens["access_token"]
    ig_user_id = connector.get("platform_account_id", "")
    user_id = str(connector.get("user_id", ""))
    connector_id = str(connector.get("_id", ""))

    if not ig_user_id:
        raise ValueError("No Instagram user ID in connector (platform_account_id missing)")

    # Fetch username for campaign_name
    username = _fetch_username(ig_user_id, access_token)

    # Fetch daily insights for last 30 days
    rows = _fetch_insights(ig_user_id, access_token, user_id, connector_id, username)

    logger.info("Instagram insights fetch: ig_user=%s rows=%d", ig_user_id, len(rows))
    return rows


def _fetch_username(ig_user_id: str, access_token: str) -> str:
    try:
        with httpx.Client(timeout=15) as client:
            resp = client.get(f"{_API_BASE}/me", params={
                "access_token": access_token,
                "fields": "username"
            })
            if resp.is_success:
                return resp.json().get("username", ig_user_id)
    except Exception:
        pass
    return ig_user_id


def _fetch_insights(
    ig_user_id: str,
    access_token: str,
    user_id: str,
    connector_id: str,
    username: str,
) -> list[dict]:
    today = date.today()
    since = int((datetime.combine(today - timedelta(days=30), datetime.min.time())).timestamp())
    until = int((datetime.combine(today, datetime.min.time())).timestamp())

    docs = []
    try:
        with httpx.Client(timeout=30) as client:
            resp = client.get(
                f"{_API_BASE}/{ig_user_id}/insights",
                params={
                    "metric": "impressions,reach",
                    "period": "day",
                    "since": since,
                    "until": until,
                    "access_token": access_token,
                }
            )
            if not resp.is_success:
                logger.warning(
                    "Instagram insights API error %s: %s",
                    resp.status_code,
                    resp.text[:200],
                )
                return []

            data = resp.json().get("data", [])
            # data is a list of metric objects, each with "values" array.
            # Build a date->metrics map.
            date_map: dict[str, dict] = {}
            for metric_obj in data:
                metric_name = metric_obj.get("name")
                for val_entry in metric_obj.get("values", []):
                    end_time = val_entry.get("end_time", "")[:10]  # "YYYY-MM-DD"
                    if end_time not in date_map:
                        date_map[end_time] = {"impressions": 0, "reach": 0}
                    try:
                        date_map[end_time][metric_name] = int(val_entry.get("value", 0))
                    except (TypeError, ValueError):
                        pass

            for date_str, metrics in date_map.items():
                if not date_str:
                    continue
                docs.append(marketing_data_doc(
                    user_id=user_id,
                    connector_id=connector_id,
                    platform="instagram_login",
                    date=date_str,
                    account_id=ig_user_id,
                    campaign_id="page_insights",
                    campaign_name=f"@{username} (Page)",
                    impressions=metrics.get("impressions", 0),
                    clicks=0,
                    spend=0.0,
                    conversions=0,
                    revenue=0.0,
                    ctr=0.0,
                    cpc=0.0,
                    roas=0.0,
                    device=None,
                    currency="USD",
                ))
    except Exception as exc:
        logger.warning("Instagram insights fetch error: %s", exc)

    return docs
