"""
AI router — Phase 6.3.

Endpoints
---------
  POST /api/v1/ai/query
      Accept a natural-language question, run the full AI pipeline
      (generate → execute → explain → persist), return the result.

  GET  /api/v1/ai/history?limit=20&offset=0
      Return paginated history of AI queries for the authenticated user.

Both endpoints require a valid JWT.
"""

import logging

from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.database import get_db
from app.middleware.auth import get_current_user
from app.schemas.ai import AiQueryRequest
from app.services.ai_service import run_ai_query
from app.utils.response import error_response, success_response

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/ai", tags=["ai"])


# ── Serialisers ───────────────────────────────────────────────────────────────

def _iso(v) -> str:
    return v.isoformat() if hasattr(v, "isoformat") else str(v)


def _serialize_full(doc: dict) -> dict:
    return {
        "id":          doc.get("id") or str(doc.get("_id", "")),
        "question":    doc.get("question", ""),
        "pipeline":    doc.get("pipeline", []),
        "result":      doc.get("result", []),
        "explanation": doc.get("explanation", ""),
        "created_at":  _iso(doc.get("created_at")),
    }


def _serialize_item(doc: dict) -> dict:
    return {
        "id":           str(doc["_id"]),
        "question":     doc.get("question", ""),
        "explanation":  doc.get("explanation", ""),
        "result_count": len(doc.get("result", [])),
        "created_at":   _iso(doc.get("created_at")),
    }


# ── POST /ai/query ────────────────────────────────────────────────────────────

@router.post("/query")
async def ai_query(
    body: AiQueryRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Run a natural-language marketing data query through the local Llama model.

    Flow:
      1. Llama generates a MongoDB aggregation pipeline
      2. Pipeline is executed against marketing_data
      3. Llama explains the result in plain English
      4. Query + result + explanation persisted to ai_queries

    Returns the full result including pipeline, result rows, and explanation.
    """
    user_id = str(current_user["_id"])
    logger.info("AI query from user %s: %s", user_id, body.question[:80])

    try:
        doc = await run_ai_query(body.question, user_id, db)
    except RuntimeError as exc:
        # Ollama not running or not reachable
        return error_response(str(exc), status_code=503)
    except ValueError as exc:
        # Invalid pipeline / question
        return error_response(str(exc), status_code=422)
    except Exception as exc:
        logger.exception("AI query failed: %s", exc)
        return error_response(f"AI query failed: {exc}", status_code=500)

    return success_response(
        data=_serialize_full(doc),
        message="Query completed successfully",
    )


# ── GET /ai/history ───────────────────────────────────────────────────────────

@router.get("/history")
async def ai_history(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Return paginated history of AI queries for the authenticated user.

    Most recent queries first. Each item includes the question, explanation,
    number of result rows, and timestamp. (Full result / pipeline omitted for brevity.)
    """
    user_id = str(current_user["_id"])
    total = await db["ai_queries"].count_documents({"user_id": user_id})

    cursor = (
        db["ai_queries"]
        .find({"user_id": user_id}, {"result": 0, "pipeline": 0})  # lean projection
        .sort("created_at", -1)
        .skip(offset)
        .limit(limit)
    )
    items = await cursor.to_list(length=limit)

    return success_response(
        data={
            "items":  [_serialize_item(doc) for doc in items],
            "total":  total,
            "limit":  limit,
            "offset": offset,
        },
        message="History retrieved",
    )


# ── GET /ai/history/{query_id} ────────────────────────────────────────────────

@router.get("/history/{query_id}")
async def ai_history_detail(
    query_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Fetch the full result of a single historical AI query by ID."""
    from bson import ObjectId
    from bson.errors import InvalidId

    user_id = str(current_user["_id"])
    try:
        oid = ObjectId(query_id)
    except InvalidId:
        return error_response("Invalid query ID", status_code=422)

    doc = await db["ai_queries"].find_one({"_id": oid, "user_id": user_id})
    if not doc:
        return error_response("Query not found", status_code=404)

    return success_response(data=_serialize_full(doc), message="Query retrieved")
