"""
Unified marketing data model — Phase 3.1.

One document = one campaign's metrics for one day on one platform.
The unique compound index (user_id, platform, date, campaign_id) named
`unique_data_point` prevents duplicate daily syncs and allows safe upserts.
"""
from datetime import datetime, timezone
from typing import Optional
from bson import ObjectId


def marketing_data_doc(
    user_id: str,
    connector_id: str,
    platform: str,
    date: str,           # ISO date string "YYYY-MM-DD"
    account_id: str,
    campaign_id: str,
    campaign_name: str,
    # Core metrics
    impressions: int = 0,
    clicks: int = 0,
    spend: float = 0.0,
    conversions: int = 0,
    revenue: float = 0.0,
    # Derived metrics (computed by fetch_data, stored for query performance)
    ctr: float = 0.0,    # clicks / impressions * 100
    cpc: float = 0.0,    # spend / clicks
    roas: float = 0.0,   # revenue / spend
    # Dimensions
    device: Optional[str] = None,
    country: Optional[str] = None,
    currency: str = "USD",
) -> dict:
    """
    Build a marketing data dict ready for upsert into `db['marketing_data']`.
    Use with update_one(..., upsert=True) keyed on the unique_data_point index.
    """
    return {
        "user_id": user_id,
        "connector_id": connector_id,
        "platform": platform,
        "date": date,
        "account_id": account_id,
        "campaign_id": campaign_id,
        "campaign_name": campaign_name,
        "metrics": {
            "impressions": impressions,
            "clicks": clicks,
            "spend": round(spend, 2),
            "conversions": conversions,
            "revenue": round(revenue, 2),
            "ctr": round(ctr, 4),
            "cpc": round(cpc, 4),
            "roas": round(roas, 4),
        },
        "dimensions": {
            "device": device,
            "country": country,
            "currency": currency,
        },
        "synced_at": datetime.now(timezone.utc),
    }


def compute_derived_metrics(
    impressions: int,
    clicks: int,
    spend: float,
    revenue: float,
) -> dict:
    """
    Compute CTR, CPC, ROAS safely (no ZeroDivisionError).
    Returns dict with ctr, cpc, roas.
    """
    ctr = (clicks / impressions * 100) if impressions > 0 else 0.0
    cpc = (spend / clicks) if clicks > 0 else 0.0
    roas = (revenue / spend) if spend > 0 else 0.0
    return {
        "ctr": round(ctr, 4),
        "cpc": round(cpc, 4),
        "roas": round(roas, 4),
    }


# Filter key used for upsert operations — matches the unique_data_point index
def upsert_filter(user_id: str, platform: str, date: str, campaign_id: str) -> dict:
    """Returns the MongoDB filter dict for a safe upsert."""
    return {
        "user_id": user_id,
        "platform": platform,
        "date": date,
        "campaign_id": campaign_id,
    }
