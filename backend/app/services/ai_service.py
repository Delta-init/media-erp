"""
AI service — Ollama local backend.

Steps for every query:
  1. Generate a MongoDB aggregation pipeline via Llama (local, no rate limits)
  2. Execute the pipeline against marketing_data
  3. Explain the result in plain English via Llama
  4. Persist the query + result + explanation to ai_queries
"""

import json
import logging
import re
from datetime import datetime, timezone
from typing import Any

import ollama
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.config import settings
from app.utils.timezone import utc_iso

logger = logging.getLogger(__name__)


# ── Schema description sent to the model ──────────────────────────────────────

_SCHEMA = """
Collection: marketing_data
One document = one campaign's metrics for one day on one platform.

Fields:
  user_id              : string   — always filter by this (data isolation)
  platform             : string   — "google_ads" | "facebook_ads" | "linkedin_ads" | "ga4" | "tiktok_ads"
  date                 : string   — ISO date "YYYY-MM-DD"
  campaign_id          : string
  campaign_name        : string
  metrics.impressions  : number
  metrics.clicks       : number
  metrics.spend        : number   (USD)
  metrics.conversions  : number
  metrics.revenue      : number   (USD)
  metrics.ctr          : number   (click-through rate, 0-100)
  metrics.cpc          : number   (cost per click, USD)
  metrics.roas         : number   (revenue / spend)
  dimensions.device    : string | null
  dimensions.country   : string | null
  dimensions.currency  : string   (default "USD")
  synced_at            : ISODate
"""

_PIPELINE_SYSTEM = (
    "You are a MongoDB expert. Generate a valid MongoDB aggregation pipeline as a JSON array.\n\n"
    "Schema:\n" + _SCHEMA + "\n"
    "RULES:\n"
    "1. The FIRST stage MUST be {\"$match\": {\"user_id\": \"{user_id}\"}}.\n"
    "2. Use $sum for numeric aggregations.\n"
    "3. Do NOT use $out or $merge stages.\n"
    "4. Add a $limit stage (max 100) unless the query is about counts only.\n"
    "5. Return ONLY a valid JSON array — no markdown, no code fences, no explanation.\n"
    "6. Output must start with [ and end with ].\n"
    "7. No JavaScript comments (// or /* */). No trailing commas. Pure JSON only.\n"
    "8. The 'date' field is stored as an ISO string (YYYY-MM-DD). "
    "For 'last N days' queries use $match with "
    "{\"date\": {\"$gte\": \"YYYY-MM-DD\"}} using a real ISO date string. "
    "Do NOT use $dateSubtract or $$NOW — they do not work on string fields.\n"
)

_EXPLAIN_SYSTEM = (
    "You are a marketing analyst. Given a question and query results, "
    "write 2-3 clear sentences explaining the key findings. "
    "Be specific about numbers. Return only plain text — no markdown, no bullet points."
)

# ── Forbidden pipeline stages ─────────────────────────────────────────────────

_FORBIDDEN = frozenset({"$out", "$merge"})


# ── Ollama async client ───────────────────────────────────────────────────────

def _get_client() -> ollama.AsyncClient:
    return ollama.AsyncClient(host=settings.ollama_base_url)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _strip_fences(text: str) -> str:
    """Remove markdown code fences the model may add."""
    text = text.strip()
    # Remove ```json ... ``` or ``` ... ```
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    # Find the first [ and last ] to extract just the array
    start = text.find("[")
    end   = text.rfind("]")
    if start != -1 and end != -1 and end > start:
        text = text[start:end + 1]
    return text.strip()


def _repair_json(text: str) -> str:
    """Fix the most common JSON mistakes small LLMs produce.

    llama3.2:3b frequently emits:
      • JS-style line comments  → // ...
      • JS-style block comments → /* ... */
      • Trailing commas         → {"k": "v",}  or  [a, b,]
    All three are illegal JSON.  Strip them before parsing.
    """
    # Remove JS-style block comments first (may span lines)
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.DOTALL)
    # Remove JS-style line comments
    text = re.sub(r"//[^\n]*", "", text)
    # Remove trailing commas before } or ]
    text = re.sub(r",\s*([\}\]])", r"\1", text)
    return text.strip()


def _validate_pipeline(pipeline: Any, user_id: str) -> list[dict]:
    """Validate and sanitise the AI-generated pipeline."""
    if not isinstance(pipeline, list) or not pipeline:
        raise ValueError("Pipeline must be a non-empty JSON array.")
    for stage in pipeline:
        if not isinstance(stage, dict):
            raise ValueError("Each pipeline stage must be a JSON object.")
        for key in stage:
            if key in _FORBIDDEN:
                raise ValueError(f"Pipeline stage '{key}' is not allowed.")

    # Force user_id isolation — inject if missing or wrong
    first = pipeline[0]
    if "$match" not in first or first["$match"].get("user_id") != user_id:
        pipeline.insert(0, {"$match": {"user_id": user_id}})

    return pipeline


def _to_json_safe(doc: dict) -> dict:
    """Convert a MongoDB document to a JSON-serialisable dict."""
    out: dict = {}
    for k, v in doc.items():
        if k == "_id":
            out[k] = str(v)
        elif hasattr(v, "isoformat"):
            out[k] = utc_iso(v)
        elif isinstance(v, dict):
            out[k] = _to_json_safe(v)
        elif isinstance(v, list):
            out[k] = [_to_json_safe(i) if isinstance(i, dict) else i for i in v]
        else:
            out[k] = v
    return out


# ── Ollama call ───────────────────────────────────────────────────────────────

async def _call_ollama(system: str, user_message: str) -> str:
    """Send a chat request to the local Ollama server.

    Raises RuntimeError if Ollama is not running.
    """
    client = _get_client()
    try:
        response = await client.chat(
            model=settings.ollama_model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user",   "content": user_message},
            ],
            options={"temperature": 0.1},   # low temp for deterministic JSON
        )
        return response.message.content
    except Exception as exc:
        err = str(exc).lower()
        if "connection" in err or "refused" in err or "connect" in err:
            raise RuntimeError(
                f"Cannot reach Ollama at {settings.ollama_base_url}. "
                "Make sure Ollama is running (`ollama serve`)."
            ) from exc
        raise


# ── Public API ────────────────────────────────────────────────────────────────

async def generate_pipeline(question: str, user_id: str) -> list[dict]:
    """Ask the local model to generate a MongoDB aggregation pipeline.

    Attempts up to 2 times.  On the first failure the user message is
    prefixed with an explicit reminder to output pure JSON so the model
    self-corrects on the retry.
    """
    system = _PIPELINE_SYSTEM.replace("{user_id}", user_id)
    logger.info("Generating pipeline for: %s", question[:80])

    last_exc: Exception | None = None
    for attempt in range(2):
        user_msg = question if attempt == 0 else (
            "IMPORTANT: Return ONLY a valid JSON array — no comments, "
            "no trailing commas, no markdown.\n\n" + question
        )

        raw = await _call_ollama(system, user_msg)
        raw = _strip_fences(raw)
        raw = _repair_json(raw)

        try:
            pipeline = json.loads(raw)
            return _validate_pipeline(pipeline, user_id)
        except json.JSONDecodeError as exc:
            last_exc = exc
            logger.warning(
                "Attempt %d/%d — invalid JSON (%s): %s",
                attempt + 1, 2, exc, raw[:300],
            )

    raise ValueError(f"Model returned invalid JSON: {last_exc}") from last_exc


async def execute_pipeline(
    pipeline: list[dict],
    db: AsyncIOMotorDatabase,
) -> list[dict]:
    """Execute the validated pipeline against marketing_data."""
    cursor = db["marketing_data"].aggregate(pipeline)
    docs   = await cursor.to_list(length=100)
    return [_to_json_safe(doc) for doc in docs]


async def explain_result(question: str, result: list[dict]) -> str:
    """Ask the local model to explain the query result in plain English."""
    preview = json.dumps(result[:10], default=str)
    if len(preview) > 3000:
        preview = preview[:3000] + "…"

    user_message = (
        f"Question: {question}\n\n"
        f"Result ({len(result)} row{'s' if len(result) != 1 else ''}): {preview}"
    )
    text = await _call_ollama(_EXPLAIN_SYSTEM, user_message)
    return text.strip()


async def run_ai_query(
    question: str,
    user_id: str,
    db: AsyncIOMotorDatabase,
) -> dict:
    """Full AI query flow: generate → execute → explain → persist."""
    pipeline    = await generate_pipeline(question, user_id)
    result      = await execute_pipeline(pipeline, db)
    explanation = await explain_result(question, result)

    now = datetime.now(timezone.utc)
    doc = {
        "user_id":     user_id,
        "question":    question,
        "pipeline":    pipeline,
        "result":      result,
        "explanation": explanation,
        "created_at":  now,
    }
    inserted = await db["ai_queries"].insert_one({**doc})
    doc["id"] = str(inserted.inserted_id)
    return doc
