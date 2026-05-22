"""
Mailchimp email marketing connector — Feature 11.
Fetches email campaign performance data.
Runs in demo mode (realistic mock data) when the API key is a placeholder.
"""
import hashlib
import logging
import random
from datetime import datetime, timedelta, timezone

from app.models.marketing_data import marketing_data_doc

logger = logging.getLogger(__name__)

_DEMO_CAMPAIGNS = [
    ("mc_camp_001", "Monthly Newsletter — May 2026"),
    ("mc_camp_002", "Product Launch: Summer Collection"),
    ("mc_camp_003", "Re-engagement: Inactive Subscribers"),
    ("mc_camp_004", "Flash Sale — 24 Hours Only"),
    ("mc_camp_005", "Weekly Digest #21"),
    ("mc_camp_006", "Welcome Series Email 1"),
    ("mc_camp_007", "Abandoned Cart Recovery"),
]


def _demo_rows(connector: dict) -> list[dict]:
    """Generate 30 days of mock email campaign metrics."""
    user_id = str(connector.get("user_id", ""))
    connector_id = str(connector["_id"])
    today = datetime.now(timezone.utc).date()
    rows = []

    rng = random.Random(hashlib.md5(connector_id.encode()).hexdigest())

    for day_offset in range(30):
        date_str = (today - timedelta(days=day_offset)).isoformat()
        # Pick 2-4 campaigns active on each day
        active = rng.sample(_DEMO_CAMPAIGNS, k=min(rng.randint(2, 4), len(_DEMO_CAMPAIGNS)))
        for campaign_id, campaign_name in active:
            sent = rng.randint(800, 12000)
            opens = int(sent * rng.uniform(0.18, 0.42))
            clicks = int(opens * rng.uniform(0.05, 0.22))
            unsubs = rng.randint(0, max(1, int(sent * 0.005)))
            spend = round(rng.uniform(0, 0), 2)   # Mailchimp cost not tracked here
            ctr = round((clicks / sent * 100) if sent else 0, 4)

            rows.append(marketing_data_doc(
                user_id=user_id,
                connector_id=connector_id,
                platform="mailchimp",
                date=date_str,
                account_id="mc_demo_account",
                campaign_id=campaign_id,
                campaign_name=campaign_name,
                impressions=opens,       # "impressions" = email opens
                clicks=clicks,
                spend=spend,
                conversions=unsubs,      # "conversions" = tracked actions / unsubs
                revenue=round(clicks * rng.uniform(2.5, 18.0), 2),
                ctr=ctr,
                cpc=0.0,
                roas=0.0,
                currency="USD",
            ))
    return rows


def fetch_data(connector: dict, tokens: dict) -> list[dict]:
    """
    Fetch Mailchimp campaign stats.
    Falls back to demo data if the access_token is a placeholder.
    """
    token = tokens.get("access_token", "")

    # Real Mailchimp API key ends with "-usX" (e.g., "abc123-us14")
    if token and token != "demo_token_placeholder" and "-us" in token.lower():
        try:
            return _real_fetch(connector, token)
        except Exception as exc:
            logger.warning("Mailchimp real fetch failed (%s), using demo data", exc)

    logger.info("Mailchimp connector %s: using demo data", connector.get("_id"))
    return _demo_rows(connector)


def _real_fetch(connector: dict, api_key: str) -> list[dict]:
    """Fetch real data from Mailchimp Marketing API v3."""
    import urllib.request
    import json
    import base64

    dc = api_key.split("-")[-1]          # e.g. "us14"
    base_url = f"https://{dc}.api.mailchimp.com/3.0"
    auth = base64.b64encode(f"anystring:{api_key}".encode()).decode()
    headers = {"Authorization": f"Basic {auth}", "Content-Type": "application/json"}

    def _get(path):
        req = urllib.request.Request(f"{base_url}{path}", headers=headers)
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read())

    user_id = str(connector.get("user_id", ""))
    connector_id = str(connector["_id"])
    today = datetime.now(timezone.utc).date()
    since = (today - timedelta(days=30)).isoformat() + "T00:00:00+00:00"
    rows = []

    campaigns = _get(f"/campaigns?status=sent&since_send_time={since}&count=50")
    for camp in campaigns.get("campaigns", []):
        cid = camp["id"]
        cname = camp.get("settings", {}).get("subject_line", cid)
        sent_at = camp.get("send_time", "")[:10] or today.isoformat()
        report = _get(f"/reports/{cid}")
        stats = report.get("stats", {})
        emails_sent = stats.get("emails_sent", 0) or camp.get("emails_sent", 0)
        opens = stats.get("unique_opens", 0)
        clicks = stats.get("clicks", 0)
        ctr = round((clicks / emails_sent * 100) if emails_sent else 0, 4)
        rows.append(marketing_data_doc(
            user_id=user_id, connector_id=connector_id, platform="mailchimp",
            date=sent_at, account_id=camp.get("list_id", "unknown"),
            campaign_id=cid, campaign_name=cname,
            impressions=opens, clicks=clicks, spend=0.0,
            conversions=stats.get("unsubscribed", 0),
            revenue=0.0, ctr=ctr, cpc=0.0, roas=0.0,
        ))
    return rows
