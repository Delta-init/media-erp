"""Pydantic schemas for the AI query endpoints — Phase 6.3."""

from datetime import datetime
from typing import Any
from pydantic import BaseModel, Field


class AiQueryRequest(BaseModel):
    question: str = Field(..., min_length=3, max_length=1000,
                          description="Natural-language question about marketing data")


class AiQueryResponse(BaseModel):
    id: str
    question: str
    pipeline: list[dict[str, Any]]
    result: list[dict[str, Any]]
    explanation: str
    created_at: str  # ISO-8601


class AiHistoryItem(BaseModel):
    id: str
    question: str
    explanation: str
    result_count: int
    created_at: str  # ISO-8601


class AiHistoryResponse(BaseModel):
    items: list[AiHistoryItem]
    total: int
    limit: int
    offset: int
