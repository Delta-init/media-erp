"""
Google Search Console connector — Feature 12.
Fetches organic search performance: queries, impressions, clicks, CTR, position.
Runs in demo mode when no real credentials are configured.
"""
import hashlib
import logging
import random
from datetime import datetime, timedelta, timezone

from app.models.marketing_data import marketing_data_doc

logger = logging.getLogger(__name__)

_DEMO_QUERIES = [
    ("q_001", "digital marketing agency"),
    ("q_002", "social media management tool"),
    ("q_003", "marketing analytics dashboard"),
    ("q_004", "campaign performance tracking"),
    ("q_005", "facebook ads management software"),
    ("q_006", "email marketing automation"),
    ("q_007", "seo rank tracker"),
    ("q_008", "google ads optimization"),
    ("q_009", "crm integration marketing"),
    ("q_010", "best marketing erp platform"),
    ("q_011", "tiktok ads manager"),
    ("q_012", "linkedin b2b advertising"),
]


def _demo_rows(connector: dict) -> list[dict]:
    """Generate 30 days of mock search console data."""
    user_id = str(connector.get("user_id", ""))
    connector_id = str(connector["_id"])
    today = datetime.now(timezone.utc).date()
    rng = random.Random(hashlib.md5(connector_id.encode()).hexdigest())
    rows = []

    for day_offset in range(30):
        date_str = (today - timedelta(days=day_offset)).isoformat()
        active = rng.sample(_DEMO_QUERIES, k=rng.randint(4, 8))
        for query_id, query_text in active:
            impressions = rng.randint(20, 3500)
            position = round(rng.uniform(1.2, 42.0), 1)
            # CTR varies inversely with position
            base_ctr = max(0.01, 0.35 - (position - 1) * 0.008)
            clicks = int(impressions * rng.uniform(base_ctr * 0.6, base_ctr * 1.4))
            ctr = round((clicks / impressions * 100) if impressions else 0, 4)

            rows.append(marketing_data_doc(
                user_id=user_id,
                connector_id=connector_id,
                platform="search_console",
                date=date_str,
                account_id="sc_demo_site",
                campaign_id=query_id,
                campaign_name=query_text,
                impressions=impressions,
                clicks=clicks,
                spend=0.0,
                conversions=0,
                revenue=0.0,
                ctr=ctr,
                cpc=0.0,
                roas=0.0,
                currency="USD",
            ))
    return rows


def fetch_data(connector: dict, tokens: dict) -> list[dict]:
    """
    Fetch Google Search Console search analytics.
    Falls back to demo data when token is a placeholder.
    """
    token = tokens.get("access_token", "")

    if token and token != "demo_token_placeholder":
        try:
            return _real_fetch(connector, token)
        except Exception as exc:
            logger.warning("Search Console real fetch failed (%s), using demo data", exc)

    logger.info("Search Console connector %s: using demo data", connector.get("_id"))
    return _demo_rows(connector)


def _real_fetch(connector: dict, access_token: str) -> list[dict]:
    """Fetch real data from Search Console API v3."""
    import urllib.request
    import urllib.error
    import json

    user_id = str(connector.get("user_id", ""))
    connector_id = str(connector["_id"])
    site_url = connector.get("platform_account_id") or "sc-domain:example.com"
    today = datetime.now(timezone.utc).date()
    date_from = (today - timedelta(days=30)).isoformat()
    date_to = today.isoformat()

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }
    payload = json.dumps({
        "startDate": date_from, "endDate": date_to,
        "dimensions": ["query", "date"],
        "rowLimit": 1000,
    }).encode()

    encoded_site = urllib.request.quote(site_url, safe="")
    url = f"https://searchconsole.googleapis.com/webmasters/v3/sites/{encoded_site}/searchAnalytics/query"
    req = urllib.request.Request(url, data=payload, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=15) as resp:
        data = json.loads(resp.read())

    rows = []
    for row in data.get("rows", []):
        keys = row["keys"]
        query_text = keys[0] if len(keys) > 0 else "unknown"
        date_str = keys[1] if len(keys) > 1 else date_from
        impressions = int(row.get("impressions", 0))
        clicks = int(row.get("clicks", 0))
        position = row.get("position", 0)
        ctr = round(row.get("ctr", 0) * 100, 4)
        query_id = "q_" + hashlib.md5(query_text.encode()).hexdigest()[:8]
        rows.append(marketing_data_doc(
            user_id=user_id, connector_id=connector_id, platform="search_console",
            date=date_str, account_id=site_url,
            campaign_id=query_id, campaign_name=query_text,
            impressions=impressions, clicks=clicks, spend=0.0,
            conversions=0, revenue=0.0, ctr=ctr, cpc=0.0, roas=0.0,
        ))
    return rows
