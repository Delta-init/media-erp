from typing import Optional
from pydantic import BaseModel


class ReportFilters(BaseModel):
    platform: Optional[list[str]] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None


class CustomReportRequest(BaseModel):
    metrics: list[str]
    dimensions: list[str]
    filters: ReportFilters
    chart_type: str = "table"


class SaveReportRequest(CustomReportRequest):
    name: str
