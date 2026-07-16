from datetime import datetime, timezone, timedelta, date
from typing import Optional
from bson import ObjectId
from bson.errors import InvalidId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.report import report_doc, VALID_METRICS, VALID_DIMENSIONS
from app.utils.timezone import utc_iso

BASE_METRICS = {"spend", "clicks", "impressions", "conversions", "revenue"}
DERIVED_METRICS = {"ctr", "cpc", "roas"}


def _safe_round(val, ndigits=2):
    if val is None:
        return None
    try:
        return round(float(val), ndigits)
    except (TypeError, ValueError):
        return None


def _serialize(doc: dict) -> dict:
    if doc is None:
        return None
    result = {}
    for k, v in doc.items():
        if isinstance(v, ObjectId):
            result[k] = str(v)
        elif isinstance(v, datetime):
            # datetimes carry an explicit UTC offset so the IST frontend
            # converts them correctly (Motor returns naive UTC).
            result[k] = utc_iso(v)
        elif isinstance(v, date):
            # calendar dates have no time component — never shift them
            result[k] = v.isoformat()
        elif isinstance(v, dict):
            result[k] = _serialize(v)
        elif isinstance(v, list):
            result[k] = [_serialize(i) if isinstance(i, dict) else i for i in v]
        else:
            result[k] = v
    return result


def _build_match(user_id: str, date_from: Optional[str], date_to: Optional[str], platform: Optional[str] = None) -> dict:
    match = {"user_id": user_id}
    date_filter = {}
    if date_from:
        date_filter["$gte"] = date_from
    if date_to:
        date_filter["$lte"] = date_to
    if date_filter:
        match["date"] = date_filter
    if platform:
        match["platform"] = platform
    return match


def _sum_stage(fields: list) -> dict:
    group = {"_id": None}
    for f in fields:
        group[f] = {"$sum": f"$metrics.{f}"}
    return group


def _compute_deltas(current: dict, prev: dict) -> dict:
    result = {}
    for key, cur_val in current.items():
        prev_val = prev.get(key, 0) or 0
        if prev_val == 0:
            delta = None
        else:
            delta = _safe_round((cur_val - prev_val) / prev_val * 100)
        result[key] = {"value": _safe_round(cur_val), "delta": delta}
    return result


async def get_overview(
    user_id: str,
    date_from: str,
    date_to: str,
    platform: Optional[str],
    db: AsyncIOMotorDatabase,
) -> dict:
    col = db["marketing_data"]

    async def _aggregate(df: str, dt: str) -> dict:
        match = _build_match(user_id, df, dt, platform)
        pipeline = [
            {"$match": match},
            {
                "$group": {
                    "_id": None,
                    "spend": {"$sum": "$metrics.spend"},
                    "clicks": {"$sum": "$metrics.clicks"},
                    "impressions": {"$sum": "$metrics.impressions"},
                    "conversions": {"$sum": "$metrics.conversions"},
                    "revenue": {"$sum": "$metrics.revenue"},
                }
            },
        ]
        result = await col.aggregate(pipeline).to_list(1)
        if not result:
            return {"spend": 0, "clicks": 0, "impressions": 0, "conversions": 0, "revenue": 0}
        r = result[0]
        spend = r.get("spend") or 0
        impressions = r.get("impressions") or 0
        clicks = r.get("clicks") or 0
        revenue = r.get("revenue") or 0
        r["ctr"] = (clicks / impressions * 100) if impressions else 0
        r["roas"] = (revenue / spend) if spend else 0
        return r

    # Current period
    current = await _aggregate(date_from, date_to)

    # Previous period: same-length window ending one day before date_from
    try:
        df_dt = datetime.strptime(date_from, "%Y-%m-%d").date()
        dt_dt = datetime.strptime(date_to, "%Y-%m-%d").date()
        delta_days = (dt_dt - df_dt).days
        prev_end = df_dt - timedelta(days=1)
        prev_start = prev_end - timedelta(days=delta_days)
        prev = await _aggregate(prev_start.strftime("%Y-%m-%d"), prev_end.strftime("%Y-%m-%d"))
    except (ValueError, TypeError):
        prev = {}

    kpi_keys = ["spend", "clicks", "impressions", "conversions", "revenue", "ctr", "roas"]
    kpis = {}
    for key in kpi_keys:
        cur_val = current.get(key, 0) or 0
        prev_val = prev.get(key, 0) or 0
        if prev_val == 0:
            delta = None
        else:
            delta = _safe_round((cur_val - prev_val) / prev_val * 100)
        kpis[key] = {"value": _safe_round(cur_val), "delta": delta}

    return {
        "kpis": kpis,
        "date_from": date_from,
        "date_to": date_to,
        "platform": platform,
    }


async def get_campaigns(
    user_id: str,
    platform: Optional[str],
    page: int,
    limit: int,
    search: Optional[str],
    sort_by: str,
    sort_dir: str,
    date_from: Optional[str],
    date_to: Optional[str],
    db: AsyncIOMotorDatabase,
) -> dict:
    col = db["marketing_data"]
    match = _build_match(user_id, date_from, date_to, platform)

    pipeline = [
        {"$match": match},
        {
            "$group": {
                "_id": {
                    "campaign_id": "$campaign_id",
                    "campaign_name": "$campaign_name",
                    "platform": "$platform",
                },
                "spend": {"$sum": "$metrics.spend"},
                "clicks": {"$sum": "$metrics.clicks"},
                "impressions": {"$sum": "$metrics.impressions"},
                "conversions": {"$sum": "$metrics.conversions"},
                "revenue": {"$sum": "$metrics.revenue"},
            }
        },
        {
            "$addFields": {
                "campaign_id": "$_id.campaign_id",
                "campaign_name": "$_id.campaign_name",
                "platform": "$_id.platform",
                "ctr": {
                    "$cond": [
                        {"$gt": ["$impressions", 0]},
                        {"$multiply": [{"$divide": ["$clicks", "$impressions"]}, 100]},
                        0,
                    ]
                },
                "cpc": {
                    "$cond": [
                        {"$gt": ["$clicks", 0]},
                        {"$divide": ["$spend", "$clicks"]},
                        0,
                    ]
                },
                "roas": {
                    "$cond": [
                        {"$gt": ["$spend", 0]},
                        {"$divide": ["$revenue", "$spend"]},
                        0,
                    ]
                },
            }
        },
        {"$project": {"_id": 0}},
    ]

    if search:
        pipeline.append({"$match": {"campaign_name": {"$regex": search, "$options": "i"}}})

    # Count total
    count_pipeline = pipeline + [{"$count": "total"}]
    count_result = await col.aggregate(count_pipeline).to_list(1)
    total = count_result[0]["total"] if count_result else 0

    # Sort
    valid_sort_fields = {"spend", "clicks", "impressions", "conversions", "revenue", "ctr", "cpc", "roas", "campaign_name"}
    if sort_by not in valid_sort_fields:
        sort_by = "spend"
    sort_direction = -1 if sort_dir.lower() == "desc" else 1

    pipeline.append({"$sort": {sort_by: sort_direction}})
    pipeline.append({"$skip": (page - 1) * limit})
    pipeline.append({"$limit": limit})

    campaigns_raw = await col.aggregate(pipeline).to_list(limit)

    # Round floats
    campaigns = []
    for c in campaigns_raw:
        rounded = {}
        for k, v in c.items():
            if isinstance(v, float):
                rounded[k] = _safe_round(v)
            else:
                rounded[k] = v
        campaigns.append(rounded)

    pages = (total + limit - 1) // limit if limit > 0 else 0

    return {
        "campaigns": campaigns,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": pages,
    }


async def get_trend(
    user_id: str,
    metric: str,
    period: str,
    platform: Optional[str],
    date_from: Optional[str],
    date_to: Optional[str],
    db: AsyncIOMotorDatabase,
) -> dict:
    valid_trend_metrics = {"spend", "clicks", "impressions", "conversions", "revenue"}
    if metric not in valid_trend_metrics:
        metric = "spend"

    col = db["marketing_data"]
    match = _build_match(user_id, date_from, date_to, platform)

    if period == "weekly":
        group_id = {
            "$dateToString": {
                "format": "%G-W%V",
                "date": {"$dateFromString": {"dateString": "$date"}},
            }
        }
    else:
        group_id = "$date"

    pipeline = [
        {"$match": match},
        {
            "$group": {
                "_id": group_id,
                "value": {"$sum": f"$metrics.{metric}"},
            }
        },
        {"$sort": {"_id": 1}},
        {"$project": {"_id": 0, "date": "$_id", "value": 1}},
    ]

    raw = await col.aggregate(pipeline).to_list(None)
    data = [{"date": r["date"], "value": _safe_round(r["value"])} for r in raw]

    return {"metric": metric, "period": period, "data": data}


async def run_custom(
    user_id: str,
    metrics: list,
    dimensions: list,
    filters: dict,
    db: AsyncIOMotorDatabase,
) -> dict:
    # Validate/filter inputs silently
    metrics = [m for m in metrics if m in VALID_METRICS]
    dimensions = [d for d in dimensions if d in VALID_DIMENSIONS]

    col = db["marketing_data"]

    # Build $match
    match = {"user_id": user_id}
    platform_list = filters.get("platform") if filters else None
    date_from = filters.get("date_from") if filters else None
    date_to = filters.get("date_to") if filters else None

    if platform_list:
        match["platform"] = {"$in": platform_list}
    if date_from and date_to:
        match["date"] = {"$gte": date_from, "$lte": date_to}
    elif date_from:
        match["date"] = {"$gte": date_from}
    elif date_to:
        match["date"] = {"$lte": date_to}

    # Build $group _id from dimensions
    group_id = {}
    for dim in dimensions:
        if dim == "platform":
            group_id["platform"] = "$platform"
        elif dim == "campaign":
            group_id["campaign_id"] = "$campaign_id"
            group_id["campaign_name"] = "$campaign_name"
        elif dim == "date":
            group_id["date"] = "$date"
        elif dim == "device":
            group_id["device"] = "$dimensions.device"
        elif dim == "country":
            group_id["country"] = "$dimensions.country"

    group_stage = {"_id": group_id if group_id else None}

    # Sum base metrics only
    base_metrics_to_sum = [m for m in metrics if m in BASE_METRICS]
    # Always sum base metrics needed for derived computation
    needed_for_derived = set()
    if "ctr" in metrics:
        needed_for_derived.update(["clicks", "impressions"])
    if "cpc" in metrics:
        needed_for_derived.update(["clicks", "spend"])
    if "roas" in metrics:
        needed_for_derived.update(["revenue", "spend"])

    all_base_to_sum = set(base_metrics_to_sum) | needed_for_derived
    for m in all_base_to_sum:
        group_stage[m] = {"$sum": f"$metrics.{m}"}

    pipeline = [
        {"$match": match},
        {"$group": group_stage},
    ]

    # Promote _id keys to top level
    if group_id:
        promote = {k: f"$_id.{k}" for k in group_id.keys()}
        pipeline.append({"$addFields": promote})

    # Derived metrics with $cond guards
    derived_fields = {}
    if "ctr" in metrics:
        derived_fields["ctr"] = {
            "$cond": [
                {"$gt": ["$impressions", 0]},
                {"$multiply": [{"$divide": ["$clicks", "$impressions"]}, 100]},
                0,
            ]
        }
    if "cpc" in metrics:
        derived_fields["cpc"] = {
            "$cond": [
                {"$gt": ["$clicks", 0]},
                {"$divide": ["$spend", "$clicks"]},
                0,
            ]
        }
    if "roas" in metrics:
        derived_fields["roas"] = {
            "$cond": [
                {"$gt": ["$spend", 0]},
                {"$divide": ["$revenue", "$spend"]},
                0,
            ]
        }

    if derived_fields:
        pipeline.append({"$addFields": derived_fields})

    pipeline.append({"$project": {"_id": 0}})

    raw = await col.aggregate(pipeline).to_list(2000)

    # Round floats
    data = []
    for row in raw:
        rounded = {}
        for k, v in row.items():
            if isinstance(v, float):
                rounded[k] = _safe_round(v)
            else:
                rounded[k] = v
        data.append(rounded)

    return {"data": data, "metrics": metrics, "dimensions": dimensions}


async def blend_platforms(
    user_id: str,
    sources: list[dict],   # [{platform: str, metrics: [str]}]
    date_from: str,
    date_to: str,
    db: AsyncIOMotorDatabase,
) -> dict:
    """
    Cross-platform data blend.

    For each source (platform + metric list) run a daily aggregation,
    then merge all results on the shared `date` key so the client can
    render every platform's metrics on the same date axis.

    Returns:
      {
        "dates": ["2024-01-01", ...],
        "series": [
          {"key": "google_ads.spend",    "platform": "google_ads",    "metric": "spend",    "data": [1200, ...]},
          {"key": "facebook_ads.clicks", "platform": "facebook_ads",  "metric": "clicks",   "data": [340,  ...]},
        ],
        "date_from": "...", "date_to": "..."
      }
    """
    col = db["marketing_data"]

    BLEND_BASE   = {"spend", "clicks", "impressions", "conversions", "revenue"}
    BLEND_DERIVED = {"ctr", "cpc", "roas"}

    # Collect every unique date across all sources first so we can fill gaps
    all_dates: set[str] = set()
    # platform → metric → {date → value}
    results: dict[str, dict[str, dict[str, float]]] = {}

    for src in sources:
        platform = src.get("platform", "")
        requested = [m for m in src.get("metrics", []) if m in BLEND_BASE | BLEND_DERIVED]
        if not platform or not requested:
            continue

        # Always sum the base metrics we need
        needed_base = set(m for m in requested if m in BLEND_BASE)
        if "ctr"  in requested: needed_base.update(["clicks", "impressions"])
        if "cpc"  in requested: needed_base.update(["clicks", "spend"])
        if "roas" in requested: needed_base.update(["revenue", "spend"])

        group_stage: dict = {"_id": "$date"}
        for m in needed_base:
            group_stage[m] = {"$sum": f"$metrics.{m}"}

        pipeline = [
            {"$match": {
                "user_id": user_id,
                "platform": platform,
                "date":    {"$gte": date_from, "$lte": date_to},
            }},
            {"$group": group_stage},
            {"$sort":  {"_id": 1}},
        ]

        raw = await col.aggregate(pipeline).to_list(None)

        # Compute derived metrics
        platform_data: dict[str, dict[str, float]] = {}  # metric → {date → val}
        for row in raw:
            date = row["_id"]
            all_dates.add(date)
            sp = row.get("spend", 0) or 0
            cl = row.get("clicks", 0) or 0
            im = row.get("impressions", 0) or 0
            rv = row.get("revenue", 0) or 0

            computed: dict[str, float] = {}
            for m in needed_base:
                computed[m] = _safe_round(row.get(m, 0) or 0)
            if "ctr"  in requested:
                computed["ctr"]  = _safe_round((cl / im * 100) if im else 0)
            if "cpc"  in requested:
                computed["cpc"]  = _safe_round((sp / cl) if cl else 0)
            if "roas" in requested:
                computed["roas"] = _safe_round((rv / sp) if sp else 0)

            for metric in requested:
                if metric not in platform_data:
                    platform_data[metric] = {}
                platform_data[metric][date] = computed.get(metric, 0)

        results[platform] = platform_data

    # Build sorted date list and fill gaps with 0
    sorted_dates = sorted(all_dates)
    series = []
    for src in sources:
        platform = src.get("platform", "")
        requested = [m for m in src.get("metrics", []) if m in BLEND_BASE | BLEND_DERIVED]
        if platform not in results:
            continue
        for metric in requested:
            date_map = results[platform].get(metric, {})
            series.append({
                "key":      f"{platform}.{metric}",
                "platform": platform,
                "metric":   metric,
                "data":     [date_map.get(d, 0) for d in sorted_dates],
            })

    return {
        "dates":     sorted_dates,
        "series":    series,
        "date_from": date_from,
        "date_to":   date_to,
    }


async def get_saved_reports(user_id: str, db: AsyncIOMotorDatabase) -> list:
    col = db["reports"]
    cursor = col.find({"user_id": user_id}).sort("created_at", -1)
    docs = await cursor.to_list(None)
    return [_serialize(doc) for doc in docs]


async def create_saved_report(
    user_id: str,
    name: str,
    metrics: list,
    dimensions: list,
    filters: dict,
    chart_type: str,
    db: AsyncIOMotorDatabase,
) -> dict:
    col = db["reports"]
    doc = report_doc(user_id, name, metrics, dimensions, filters, chart_type)
    result = await col.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _serialize(doc)


async def get_saved_report(report_id: str, user_id: str, db: AsyncIOMotorDatabase) -> Optional[dict]:
    col = db["reports"]
    try:
        oid = ObjectId(report_id)
    except (InvalidId, Exception):
        return None
    doc = await col.find_one({"_id": oid, "user_id": user_id})
    if doc is None:
        return None
    return _serialize(doc)


async def delete_saved_report(report_id: str, user_id: str, db: AsyncIOMotorDatabase) -> bool:
    col = db["reports"]
    try:
        oid = ObjectId(report_id)
    except (InvalidId, Exception):
        return False
    result = await col.delete_one({"_id": oid, "user_id": user_id})
    return result.deleted_count > 0
