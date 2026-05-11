from datetime import datetime, timezone

VALID_METRICS = {"impressions", "clicks", "spend", "conversions", "revenue", "ctr", "cpc", "roas"}
VALID_DIMENSIONS = {"platform", "campaign", "date", "device", "country"}
VALID_CHART_TYPES = {"line", "bar", "donut", "table"}


def report_doc(
    user_id: str,
    name: str,
    metrics: list,
    dimensions: list,
    filters: dict,
    chart_type: str,
) -> dict:
    return {
        "user_id": user_id,
        "name": name,
        "metrics": metrics,
        "dimensions": dimensions,
        "filters": filters,
        "chart_type": chart_type if chart_type in VALID_CHART_TYPES else "table",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
