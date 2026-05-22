"""
Shopify e-commerce connector — marketing data fetch.
Fetches order/ad campaign performance data.
Runs in demo mode (realistic mock data) when the API key is a placeholder.
"""
import hashlib
import logging
import random
from datetime import datetime, timedelta, timezone

from app.models.marketing_data import marketing_data_doc

logger = logging.getLogger(__name__)

# (campaign_id, campaign_name, base_spend, base_impressions, base_conv_rate, base_roas)
_DEMO_CAMPAIGNS = [
    ("sh_camp_001", "Spring Sale Campaign",              800.0, 28000, 0.038, 5.5),
    ("sh_camp_002", "Product Spotlight: Featured Items", 400.0, 15000, 0.022, 4.0),
    ("sh_camp_003", "Abandoned Cart Recovery",           150.0,  4500, 0.085, 6.8),
    ("sh_camp_004", "New Customer Acquisition",          600.0, 22000, 0.018, 3.2),
    ("sh_camp_005", "Loyalty Rewards",                   200.0,  6000, 0.055, 7.5),
]


def _demo_rows(connector: dict) -> list[dict]:
    """Generate 30 days of mock Shopify e-commerce campaign metrics."""
    user_id = str(connector.get("user_id", ""))
    connector_id = str(connector["_id"])
    today = datetime.now(timezone.utc).date()
    rows = []

    rng = random.Random(hashlib.md5(connector_id.encode()).hexdigest())

    for day_offset in range(30):
        date_str = (today - timedelta(days=day_offset)).isoformat()

        # All campaigns run every day, but with daily variance
        for campaign_id, campaign_name, base_spend, base_impressions, base_conv_rate, base_roas in _DEMO_CAMPAIGNS:
            # Apply ±25 % daily noise
            noise = rng.uniform(0.75, 1.25)

            spend = round(base_spend * noise, 2)
            impressions = int(base_impressions * noise)

            # CTR: 2–5 % range, campaign-specific baseline
            ctr_pct = rng.uniform(2.0, 5.0)
            clicks = int(impressions * ctr_pct / 100)

            # Conversions (purchases)
            conv_rate = base_conv_rate * rng.uniform(0.80, 1.20)
            conversions = max(1, int(clicks * conv_rate))

            # Revenue: ROAS in 3–8 × range, anchored to base_roas
            roas_val = base_roas * rng.uniform(0.85, 1.15)
            roas_val = round(max(3.0, min(8.0, roas_val)), 4)
            revenue = round(spend * roas_val, 2)

            # Derived metrics
            ctr = round(ctr_pct, 4)
            cpc = round(spend / clicks, 4) if clicks else 0.0
            roas_stored = round(revenue / spend, 4) if spend else 0.0

            rows.append(marketing_data_doc(
                user_id=user_id,
                connector_id=connector_id,
                platform="shopify",
                date=date_str,
                account_id="shopify_demo_store",
                campaign_id=campaign_id,
                campaign_name=campaign_name,
                impressions=impressions,
                clicks=clicks,
                spend=spend,
                conversions=conversions,
                revenue=revenue,
                ctr=ctr,
                cpc=cpc,
                roas=roas_stored,
                currency="USD",
            ))

    return rows


def fetch_data(connector: dict, tokens: dict) -> list[dict]:
    """
    Fetch Shopify marketing campaign stats.
    Falls back to demo data if the access_token is a placeholder.
    """
    token = tokens.get("access_token", "")

    # Real Shopify access tokens begin with "shpat_"
    if token and token != "demo_token_placeholder" and token.startswith("shpat_"):
        try:
            return _real_fetch(connector, token)
        except Exception as exc:
            logger.warning("Shopify real fetch failed (%s), using demo data", exc)

    logger.info("Shopify connector %s: using demo data", connector.get("_id"))
    return _demo_rows(connector)


def _real_fetch(connector: dict, access_token: str) -> list[dict]:
    """Fetch real data from Shopify Admin REST API (orders + marketing events)."""
    import urllib.request
    import json

    shop_domain = connector.get("metadata", {}).get("shop_domain", "")
    if not shop_domain:
        raise ValueError("shop_domain missing from connector metadata")

    base_url = f"https://{shop_domain}/admin/api/2024-01"
    headers = {
        "X-Shopify-Access-Token": access_token,
        "Content-Type": "application/json",
    }

    def _get(path: str) -> dict:
        req = urllib.request.Request(f"{base_url}{path}", headers=headers)
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read())

    user_id = str(connector.get("user_id", ""))
    connector_id = str(connector["_id"])
    today = datetime.now(timezone.utc).date()
    since = (today - timedelta(days=30)).strftime("%Y-%m-%dT00:00:00Z")

    rows = []

    # Pull paid orders in the last 30 days and group by day
    orders_data = _get(
        f"/orders.json?status=any&created_at_min={since}&limit=250&fields=id,created_at,total_price,source_name"
    )
    for order in orders_data.get("orders", []):
        created_at = order.get("created_at", "")[:10] or today.isoformat()
        revenue = float(order.get("total_price", 0))
        source = order.get("source_name", "unknown")
        rows.append(marketing_data_doc(
            user_id=user_id,
            connector_id=connector_id,
            platform="shopify",
            date=created_at,
            account_id=shop_domain,
            campaign_id=f"shopify_order_{source}",
            campaign_name=f"Shopify Orders — {source}",
            impressions=0,
            clicks=0,
            spend=0.0,
            conversions=1,
            revenue=revenue,
            ctr=0.0,
            cpc=0.0,
            roas=0.0,
            currency="USD",
        ))

    return rows
