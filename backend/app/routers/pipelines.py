"""
Pipelines router — team workflow graphs.

Endpoints
---------
  GET    /api/v1/pipelines           — list all pipelines
  POST   /api/v1/pipelines           — create pipeline (SA/Admin/Coordinator)
  GET    /api/v1/pipelines/{id}      — get pipeline detail
  PUT    /api/v1/pipelines/{id}      — update pipeline (SA/Admin/Coordinator)
  DELETE /api/v1/pipelines/{id}      — delete pipeline (SA/Admin/Coordinator)
"""

from datetime import datetime, timezone

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.pipeline import CreatePipelineRequest, UpdatePipelineRequest
from app.utils.response import error_response, success_response

router = APIRouter(prefix="/api/v1/pipelines", tags=["pipelines"])

# ── Permission helpers ────────────────────────────────────────────────────────

def _role_name(user: dict) -> str:
    return (user.get("_role") or {}).get("role_name", "")

def _can_manage(user: dict) -> bool:
    """SA / Admin / Coordinator may create / edit / delete pipelines."""
    return _role_name(user) in ("Super Admin", "Admin", "Coordinator")

def _has_view(user: dict) -> bool:
    """Anyone with pipeline.view (all roles except maybe custom) may read."""
    role = user.get("_role") or {}
    if role.get("role_name") == "Super Admin":
        return True
    return bool((role.get("permissions") or {}).get("pipeline", {}).get("view", False))


# ── Serializer ────────────────────────────────────────────────────────────────

def _serialize(doc: dict) -> dict:
    out = {**doc}
    out["id"] = str(doc["_id"])
    del out["_id"]
    if "created_at" in out and hasattr(out["created_at"], "isoformat"):
        out["created_at"] = out["created_at"].isoformat()
    if "updated_at" in out and hasattr(out["updated_at"], "isoformat"):
        out["updated_at"] = out["updated_at"].isoformat()
    return out


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("")
async def list_pipelines(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    if not _has_view(current_user):
        return error_response("Access denied", status_code=403)
    docs = await db["pipelines"].find({}).sort("created_at", -1).to_list(500)
    return success_response(data=[_serialize(d) for d in docs])


@router.post("", status_code=201)
async def create_pipeline(
    body: CreatePipelineRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    if not _can_manage(current_user):
        return error_response("Only admins and coordinators can create pipelines.", status_code=403)
    now = datetime.now(timezone.utc)
    doc = {
        "name": body.name.strip(),
        "nodes": [n.model_dump() for n in body.nodes],
        "edges": [e.model_dump() for e in body.edges],
        "created_by": str(current_user["_id"]),
        "created_at": now,
        "updated_at": now,
    }
    result = await db["pipelines"].insert_one(doc)
    doc["_id"] = result.inserted_id
    return success_response(data=_serialize(doc), status_code=201)


@router.get("/{pipeline_id}")
async def get_pipeline(
    pipeline_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    if not _has_view(current_user):
        return error_response("Access denied", status_code=403)
    try:
        oid = ObjectId(pipeline_id)
    except InvalidId:
        return error_response("Invalid pipeline ID", status_code=422)
    doc = await db["pipelines"].find_one({"_id": oid})
    if not doc:
        return error_response("Pipeline not found", status_code=404)
    return success_response(data=_serialize(doc))


@router.put("/{pipeline_id}")
async def update_pipeline(
    pipeline_id: str,
    body: UpdatePipelineRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    if not _can_manage(current_user):
        return error_response("Only admins and coordinators can edit pipelines.", status_code=403)
    try:
        oid = ObjectId(pipeline_id)
    except InvalidId:
        return error_response("Invalid pipeline ID", status_code=422)

    updates: dict = {"updated_at": datetime.now(timezone.utc)}
    if body.name is not None:
        updates["name"] = body.name.strip()
    if body.nodes is not None:
        updates["nodes"] = [n.model_dump() for n in body.nodes]
    if body.edges is not None:
        updates["edges"] = [e.model_dump() for e in body.edges]

    doc = await db["pipelines"].find_one_and_update(
        {"_id": oid}, {"$set": updates}, return_document=True
    )
    if not doc:
        return error_response("Pipeline not found", status_code=404)
    return success_response(data=_serialize(doc))


@router.delete("/{pipeline_id}", status_code=204)
async def delete_pipeline(
    pipeline_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    if not _can_manage(current_user):
        return error_response("Only admins and coordinators can delete pipelines.", status_code=403)
    try:
        oid = ObjectId(pipeline_id)
    except InvalidId:
        return error_response("Invalid pipeline ID", status_code=422)
    result = await db["pipelines"].delete_one({"_id": oid})
    if result.deleted_count == 0:
        return error_response("Pipeline not found", status_code=404)
