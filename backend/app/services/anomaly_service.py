"""
Anomaly detection — Sprint 3.

Rolling z-score over a 14-day baseline window.
Flags days where |value − rolling_mean| > 2σ (mild) or > 3σ (severe).
"""
import math
from datetime import datetime, timedelta
from motor.motor_asyncio import AsyncIOMotorDatabase

WINDOW_DAYS      = 14   # rolling baseline width
MILD_THRESHOLD   = 2.0  # z-score ≥ 2σ → mild anomaly
SEVERE_THRESHOLD = 3.0  # z-score ≥ 3σ → severe anomaly
MIN_WINDOW_PTS   = 5    # need at least 5 data points for meaningful stats

VALID_METRICS = {"spend", "clicks", "impressions", "conversions", "revenue"}


def _stats(values: list[float]) -> tuple[float, float]:
    n = len(values)
    mean = sum(values) / n
    var  = sum((v - mean) ** 2 for v in values) / n
    return mean, math.sqrt(var)


async def detect_anomalies(
    user_id:   str,
    date_from: str,
    date_to:   str,
    metrics:   list[str],
    db: AsyncIOMotorDatabase,
) -> dict:
    metrics = [m for m in metrics if m in VALID_METRICS] or list(VALID_METRICS)

    try:
        df = datetime.strptime(date_from, "%Y-%m-%d").date()
    except ValueError:
        return {"anomalies": [], "date_from": date_from, "date_to": date_to,
                "metrics": metrics, "count": 0}

    # Fetch a wider lookback to build the rolling baseline
    lookback_start = (df - timedelta(days=WINDOW_DAYS + 1)).strftime("%Y-%m-%d")

    pipeline = [
        {"$match": {
            "user_id": user_id,
            "date": {"$gte": lookback_start, "$lte": date_to},
        }},
        {"$group": {
            "_id": {"platform": "$platform", "date": "$date"},
            **{m: {"$sum": f"$metrics.{m}"} for m in metrics},
        }},
        {"$sort": {"_id.date": 1}},
    ]

    raw = await db["marketing_data"].aggregate(pipeline).to_list(None)

    # Structure: {platform: {date: {metric: value}}}
    data: dict[str, dict[str, dict]] = {}
    for row in raw:
        plat  = row["_id"]["platform"]
        date  = row["_id"]["date"]
        data.setdefault(plat, {})[date] = {m: (row.get(m) or 0) for m in metrics}

    anomalies = []

    for platform, date_map in data.items():
        sorted_dates = sorted(date_map)

        for i, date in enumerate(sorted_dates):
            if date < date_from or date > date_to:
                continue  # only flag dates inside the requested window

            # Baseline = up to WINDOW_DAYS points *before* this date
            window_vals_raw = [d for d in sorted_dates[:i]]
            window_dates    = window_vals_raw[-WINDOW_DAYS:]

            if len(window_dates) < MIN_WINDOW_PTS:
                continue

            for metric in metrics:
                window_vals = [date_map[d][metric] for d in window_dates]
                current     = date_map[date][metric]

                mean, std = _stats(window_vals)

                if std < 1e-6:
                    continue  # no variance → can't compute z-score

                z = (current - mean) / std

                if abs(z) < MILD_THRESHOLD:
                    continue

                severity  = "severe" if abs(z) >= SEVERE_THRESHOLD else "mild"
                direction = "spike"  if z > 0 else "drop"
                pct_change = round((current - mean) / mean * 100, 1) if mean > 0 else None

                anomalies.append({
                    "platform":      platform,
                    "date":          date,
                    "metric":        metric,
                    "value":         round(current, 2),
                    "expected_mean": round(mean, 2),
                    "expected_std":  round(std, 2),
                    "z_score":       round(z, 2),
                    "severity":      severity,
                    "direction":     direction,
                    "pct_change":    pct_change,
                })

    # Most severe / recent first
    anomalies.sort(key=lambda a: (
        0 if a["severity"] == "severe" else 1,
        -abs(a["z_score"]),
    ))

    return {
        "anomalies": anomalies,
        "date_from": date_from,
        "date_to":   date_to,
        "metrics":   metrics,
        "count":     len(anomalies),
    }
