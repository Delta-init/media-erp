"""
Attribution modeling — Sprint 3.

Uses per-platform daily spend as the touchpoint proxy to redistribute
total conversions/revenue across channels via four models:

  first_touch  — 100 % to the first platform that had spend
  last_touch   — 100 % to the last platform that had spend
  linear       — equal share across all active platforms
  time_decay   — exponential decay; recency bias (half-life = 7 days)
"""
import math
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorDatabase

HALF_LIFE_DAYS = 7
MODELS = {"first_touch", "last_touch", "linear", "time_decay"}


def _decay_weight(date_str: str, end_date: str) -> float:
    try:
        d = datetime.strptime(date_str, "%Y-%m-%d").date()
        e = datetime.strptime(end_date, "%Y-%m-%d").date()
        days_ago = (e - d).days
        return math.pow(2, -days_ago / HALF_LIFE_DAYS)
    except ValueError:
        return 1.0


async def compute_attribution(
    user_id: str,
    date_from: str,
    date_to: str,
    model: str,
    db: AsyncIOMotorDatabase,
) -> dict:
    if model not in MODELS:
        model = "linear"

    col = db["marketing_data"]

    pipeline = [
        {"$match": {
            "user_id": user_id,
            "date": {"$gte": date_from, "$lte": date_to},
        }},
        {"$group": {
            "_id": {"platform": "$platform", "date": "$date"},
            "spend":       {"$sum": "$metrics.spend"},
            "clicks":      {"$sum": "$metrics.clicks"},
            "impressions": {"$sum": "$metrics.impressions"},
            "conversions": {"$sum": "$metrics.conversions"},
            "revenue":     {"$sum": "$metrics.revenue"},
        }},
        {"$sort": {"_id.date": 1}},
    ]

    raw = await col.aggregate(pipeline).to_list(None)

    if not raw:
        return {
            "model": model, "date_from": date_from, "date_to": date_to,
            "platforms": [], "total_conversions": 0, "total_revenue": 0,
        }

    # Build per-platform structures
    platforms: dict[str, dict] = {}
    total_conversions_raw = 0.0
    total_revenue_raw     = 0.0

    for row in raw:
        platform = row["_id"]["platform"]
        date     = row["_id"]["date"]
        spend    = row.get("spend", 0) or 0

        if platform not in platforms:
            platforms[platform] = {
                "platform": platform,
                "spend_by_date": {},
                "total_spend":   0.0,
                "raw_conversions": 0.0,
                "raw_revenue":     0.0,
                "clicks":       0,
                "impressions":  0,
                "first_date":   date,
                "last_date":    date,
            }

        p = platforms[platform]
        p["spend_by_date"][date] = spend
        p["total_spend"]     += spend
        p["raw_conversions"] += row.get("conversions", 0) or 0
        p["raw_revenue"]     += row.get("revenue", 0)     or 0
        p["clicks"]          += row.get("clicks", 0)      or 0
        p["impressions"]     += row.get("impressions", 0) or 0
        if date < p["first_date"]: p["first_date"] = date
        if date > p["last_date"]:  p["last_date"]  = date

        total_conversions_raw += row.get("conversions", 0) or 0
        total_revenue_raw     += row.get("revenue", 0)     or 0

    # Exclude platforms with zero spend from attribution weights
    active = [p for p in platforms.values() if p["total_spend"] > 0]
    if not active:
        active = list(platforms.values())  # fallback: include everyone

    # ── Compute weights ───────────────────────────────────────────────────────
    if model == "first_touch":
        winner = min(active, key=lambda p: p["first_date"])
        weights = {p["platform"]: (1.0 if p["platform"] == winner["platform"] else 0.0)
                   for p in active}

    elif model == "last_touch":
        winner = max(active, key=lambda p: p["last_date"])
        weights = {p["platform"]: (1.0 if p["platform"] == winner["platform"] else 0.0)
                   for p in active}

    elif model == "linear":
        n = len(active)
        share = 1.0 / n if n else 0.0
        weights = {p["platform"]: share for p in active}

    else:  # time_decay
        scores = {}
        for p in active:
            scores[p["platform"]] = sum(
                sp * _decay_weight(d, date_to)
                for d, sp in p["spend_by_date"].items()
            )
        total_score = sum(scores.values()) or 1.0
        weights = {plat: s / total_score for plat, s in scores.items()}

    # ── Distribute totals proportionally ──────────────────────────────────────
    result_platforms = []
    for p in platforms.values():
        w   = weights.get(p["platform"], 0.0)
        sp  = p["total_spend"]
        cl  = p["clicks"]
        im  = p["impressions"]
        a_conv = round(total_conversions_raw * w, 2)
        a_rev  = round(total_revenue_raw * w, 2)

        result_platforms.append({
            "platform":               p["platform"],
            "weight_pct":             round(w * 100, 1),
            "attributed_conversions": a_conv,
            "attributed_revenue":     a_rev,
            "spend":                  round(sp, 2),
            "clicks":                 cl,
            "impressions":            im,
            "ctr":  round(cl / im * 100, 2) if im else 0,
            "cpc":  round(sp / cl, 2)       if cl else 0,
            "roas": round(a_rev / sp, 2)    if sp else 0,
        })

    result_platforms.sort(key=lambda x: x["attributed_conversions"], reverse=True)

    return {
        "model":              model,
        "date_from":          date_from,
        "date_to":            date_to,
        "platforms":          result_platforms,
        "total_conversions":  round(total_conversions_raw, 2),
        "total_revenue":      round(total_revenue_raw, 2),
    }
