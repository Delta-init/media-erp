"""
Custom metric formula service — Sprint 3.

Stores user-defined calculated fields (e.g. "spend / conversions").
Formulas are validated via Python's AST module — only arithmetic on known
metric names is permitted; no function calls, no attribute access, no imports.
"""
import ast
from datetime import datetime, timezone
from typing import Optional
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.utils.timezone import utc_iso

# Metrics that may appear as variable names in a formula
ALLOWED_NAMES = {
    "spend", "clicks", "impressions", "conversions", "revenue",
    "ctr", "cpc", "roas",
}

# AST node types that are safe
_SAFE_NODES = (
    ast.Expression,
    ast.BinOp, ast.UnaryOp,
    ast.Constant, ast.Name,
    ast.Add, ast.Sub, ast.Mult, ast.Div, ast.Pow, ast.Mod,
    ast.UAdd, ast.USub,
)


# ── Validation ────────────────────────────────────────────────────────────────

def validate_formula(formula: str) -> tuple[bool, Optional[str]]:
    """Return (is_valid, error_message_or_None)."""
    formula = formula.strip()
    if not formula:
        return False, "Formula cannot be empty"
    try:
        tree = ast.parse(formula, mode="eval")
    except SyntaxError as e:
        return False, f"Syntax error: {e.msg}"

    for node in ast.walk(tree):
        if not isinstance(node, _SAFE_NODES):
            return False, (
                f"Unsupported operation '{type(node).__name__}'. "
                "Only arithmetic (+  −  ×  ÷  **  %) on metric names is allowed."
            )
        if isinstance(node, ast.Name) and node.id not in ALLOWED_NAMES:
            return False, (
                f"Unknown variable '{node.id}'. "
                f"Allowed names: {', '.join(sorted(ALLOWED_NAMES))}"
            )
    return True, None


def evaluate_formula(formula: str, values: dict[str, float]) -> Optional[float]:
    """Evaluate formula with the given metric values.  Returns None on error."""
    try:
        tree = ast.parse(formula.strip(), mode="eval")
        code = compile(tree, "<formula>", "eval")
        # Completely restricted namespace — no builtins whatsoever
        result = eval(code, {"__builtins__": {}}, values)  # noqa: S307
        return float(result)
    except ZeroDivisionError:
        return None
    except Exception:
        return None


def _safe_values(row: dict) -> dict[str, float]:
    """Extract a safe metric namespace from a data row."""
    sp = float(row.get("spend", 0) or 0)
    cl = float(row.get("clicks", 0) or 0)
    im = float(row.get("impressions", 0) or 0)
    cn = float(row.get("conversions", 0) or 0)
    rv = float(row.get("revenue", 0) or 0)
    return {
        "spend":       sp,
        "clicks":      cl,
        "impressions": im,
        "conversions": cn,
        "revenue":     rv,
        "ctr":  (cl / im * 100) if im else 0,
        "cpc":  (sp / cl)       if cl else 0,
        "roas": (rv / sp)       if sp else 0,
    }


def apply_custom_metrics(formulas: list[dict], row: dict) -> dict:
    """Add custom metric values to a data row (in-place copy).

    formulas: list of {"name": str, "formula": str}
    row:      data row with base metric keys
    Returns new dict with original keys + custom metric keys.
    """
    ns = _safe_values(row)
    out = dict(row)
    for fm in formulas:
        val = evaluate_formula(fm["formula"], ns)
        out[fm["name"]] = round(val, 4) if val is not None else None
    return out


# ── CRUD ──────────────────────────────────────────────────────────────────────

def _serialize_doc(doc: dict) -> dict:
    doc = dict(doc)
    if "_id" in doc:
        doc["_id"] = str(doc["_id"])
    if "created_at" in doc and isinstance(doc["created_at"], datetime):
        doc["created_at"] = utc_iso(doc["created_at"])
    return doc


async def list_custom_metrics(user_id: str, db: AsyncIOMotorDatabase) -> list[dict]:
    cursor = db["custom_metrics"].find({"user_id": user_id}).sort("created_at", -1)
    return [_serialize_doc(d) for d in await cursor.to_list(None)]


async def create_custom_metric(
    user_id: str,
    name: str,
    label: str,
    formula: str,
    db: AsyncIOMotorDatabase,
) -> tuple[Optional[dict], Optional[str]]:
    valid, err = validate_formula(formula)
    if not valid:
        return None, err

    # Enforce unique name per user
    if await db["custom_metrics"].find_one({"user_id": user_id, "name": name}):
        return None, f"A metric named '{name}' already exists"

    doc = {
        "user_id":    user_id,
        "name":       name.strip().lower().replace(" ", "_"),
        "label":      label.strip(),
        "formula":    formula.strip(),
        "created_at": datetime.now(timezone.utc),
    }
    result = await db["custom_metrics"].insert_one(doc)
    doc["_id"] = result.inserted_id
    return _serialize_doc(doc), None


async def delete_custom_metric(
    metric_id: str, user_id: str, db: AsyncIOMotorDatabase
) -> bool:
    try:
        oid = ObjectId(metric_id)
    except Exception:
        return False
    result = await db["custom_metrics"].delete_one({"_id": oid, "user_id": user_id})
    return result.deleted_count > 0


async def preview_formula(
    formula: str,
    sample_values: Optional[dict],
    db: AsyncIOMotorDatabase,
) -> dict:
    """Return a preview result for the formula editor."""
    valid, err = validate_formula(formula)
    if not valid:
        return {"valid": False, "error": err, "result": None}

    ns = {
        "spend": 1200.0, "clicks": 340.0, "impressions": 45000.0,
        "conversions": 28.0, "revenue": 4800.0,
        "ctr": 0.756, "cpc": 3.53, "roas": 4.0,
    }
    if sample_values:
        ns.update({k: float(v) for k, v in sample_values.items() if k in ALLOWED_NAMES})

    result = evaluate_formula(formula, ns)
    return {
        "valid": True,
        "error": None,
        "result": round(result, 4) if result is not None else None,
        "sample_inputs": {k: ns[k] for k in sorted(ALLOWED_NAMES)},
    }
