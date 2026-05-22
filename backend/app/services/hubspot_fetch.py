"""
HubSpot CRM connector — Feature 13.
Fetches deal pipeline data: deals, stage, revenue, close dates.
Runs in demo mode when no real credentials are configured.
"""
import hashlib
import logging
import random
from datetime import datetime, timedelta, timezone

from app.models.marketing_data import marketing_data_doc

logger = logging.getLogger(__name__)

_DEMO_PIPELINES = [
    ("pipe_001", "Inbound Leads", 180, 45000),
    ("pipe_002", "Outbound Prospecting", 95, 22000),
    ("pipe_003", "Partner Referrals", 210, 78000),
    ("pipe_004", "Enterprise Accounts", 42, 135000),
    ("pipe_005", "SMB Sales", 320, 12000),
    ("pipe_006", "Renewal & Upsell", 140, 55000),
    ("pipe_007", "Product-Led Growth", 260, 8500),
]


def _demo_rows(connector: dict) -> list[dict]:
    """Generate 30 days of CRM deal/pipeline activity."""
    user_id = str(connector.get("user_id", ""))
    connector_id = str(connector["_id"])
    today = datetime.now(timezone.utc).date()
    rng = random.Random(hashlib.md5(connector_id.encode()).hexdigest())
    rows = []

    for day_offset in range(30):
        date_str = (today - timedelta(days=day_offset)).isoformat()
        active = rng.sample(_DEMO_PIPELINES, k=rng.randint(2, 5))
        for pipe_id, pipe_name, avg_deals, avg_rev in active:
            deals_created = rng.randint(max(1, avg_deals // 30 - 3), avg_deals // 30 + 5)
            deals_closed = rng.randint(0, max(1, deals_created // 3))
            revenue = round(
                deals_closed * rng.uniform(avg_rev * 0.6, avg_rev * 1.4), 2
            )
            # Map: impressions=deals_created, clicks=deals_in_progress, conversions=deals_closed, revenue=deal_revenue
            deals_in_progress = rng.randint(deals_created // 2, deals_created)

            rows.append(marketing_data_doc(
                user_id=user_id,
                connector_id=connector_id,
                platform="hubspot",
                date=date_str,
                account_id="hs_demo_portal",
                campaign_id=pipe_id,
                campaign_name=pipe_name,
                impressions=deals_created,     # leads/deals created
                clicks=deals_in_progress,      # deals advanced in pipeline
                spend=0.0,
                conversions=deals_closed,      # deals closed-won
                revenue=revenue,
                ctr=round((deals_in_progress / deals_created * 100) if deals_created else 0, 4),
                cpc=0.0,
                roas=0.0,
                currency="USD",
            ))
    return rows


def fetch_data(connector: dict, tokens: dict) -> list[dict]:
    """
    Fetch HubSpot deal pipeline data.
    Falls back to demo data when token is a placeholder.
    """
    token = tokens.get("access_token", "")

    if token and token != "demo_token_placeholder":
        try:
            return _real_fetch(connector, token)
        except Exception as exc:
            logger.warning("HubSpot real fetch failed (%s), using demo data", exc)

    logger.info("HubSpot connector %s: using demo data", connector.get("_id"))
    return _demo_rows(connector)


def _real_fetch(connector: dict, access_token: str) -> list[dict]:
    """Fetch real HubSpot CRM data via Deals API v3."""
    import urllib.request
    import json

    user_id = str(connector.get("user_id", ""))
    connector_id = str(connector["_id"])
    today = datetime.now(timezone.utc).date()
    after_ts = int((datetime.now(timezone.utc) - timedelta(days=30)).timestamp() * 1000)

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }
    url = (
        "https://api.hubapi.com/crm/v3/objects/deals"
        f"?limit=100&properties=dealname,amount,pipeline,dealstage,closedate,createdate"
        f"&filterGroups=[{{\"filters\":[{{\"propertyName\":\"createdate\","
        f"\"operator\":\"GTE\",\"value\":\"{after_ts}\"}}]}}]"
    )
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=15) as resp:
        data = json.loads(resp.read())

    # Group by pipeline + date
    from collections import defaultdict
    by_pipe_date: dict = defaultdict(lambda: {"impressions": 0, "clicks": 0, "conversions": 0, "revenue": 0.0})

    for deal in data.get("results", []):
        props = deal.get("properties", {})
        pipeline = props.get("pipeline", "default")
        create_date = (props.get("createdate", "")[:10] or today.isoformat())
        amount = float(props.get("amount") or 0)
        stage = props.get("dealstage", "")
        is_closed = "closed" in stage.lower() or "won" in stage.lower()

        key = (pipeline, create_date)
        by_pipe_date[key]["impressions"] += 1
        if not is_closed:
            by_pipe_date[key]["clicks"] += 1
        if is_closed:
            by_pipe_date[key]["conversions"] += 1
            by_pipe_date[key]["revenue"] += amount

    rows = []
    for (pipeline, date_str), agg in by_pipe_date.items():
        pipe_id = "hs_" + hashlib.md5(pipeline.encode()).hexdigest()[:8]
        rows.append(marketing_data_doc(
            user_id=user_id, connector_id=connector_id, platform="hubspot",
            date=date_str, account_id=connector.get("platform_account_id", "hubspot"),
            campaign_id=pipe_id, campaign_name=pipeline.replace("_", " ").title(),
            impressions=agg["impressions"], clicks=agg["clicks"],
            spend=0.0, conversions=agg["conversions"], revenue=round(agg["revenue"], 2),
            ctr=round((agg["clicks"] / agg["impressions"] * 100) if agg["impressions"] else 0, 4),
            cpc=0.0, roas=0.0, currency="USD",
        ))
    return rows
