"""
Board statuses (Kanban columns) router.

Endpoints
---------
  GET    /api/v1/board-statuses             — list columns (auto-seeds defaults)
  POST   /api/v1/board-statuses             — create a column
  PUT    /api/v1/board-statuses/reorder     — reorder columns
  PUT    /api/v1/board-statuses/{id}        — rename / recolour a column
  DELETE /api/v1/board-statuses/{id}        — delete a column (tasks reassigned)
"""

from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.database import get_db
from app.middleware.auth import get_current_user
from app.schemas.board_status import (
    CreateStatusRequest,
    ReorderStatusesRequest,
    UpdateStatusRequest,
)
from app.services.board_status_service import (
    create_status,
    delete_status,
    list_statuses,
    reorder_statuses,
    update_status,
)
from app.utils.response import error_response, success_response

router = APIRouter(prefix="/api/v1/board-statuses", tags=["board-statuses"])


@router.get("")
async def get_statuses(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    statuses = await list_statuses(db)
    return success_response(data=statuses, message="Statuses retrieved")


@router.post("", status_code=201)
async def add_status(
    body: CreateStatusRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    if not body.label.strip():
        return error_response("Label is required", status_code=400)
    status = await create_status(db, body.label, body.color)
    return success_response(data=status, message="Status created", status_code=201)


@router.put("/reorder")
async def reorder(
    body: ReorderStatusesRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    statuses = await reorder_statuses(db, body.ordered_ids)
    return success_response(data=statuses, message="Statuses reordered")


@router.put("/{status_id}")
async def edit_status(
    status_id: str,
    body: UpdateStatusRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    status = await update_status(db, status_id, body.model_dump(exclude_none=True))
    if not status:
        return error_response("Status not found", status_code=404)
    return success_response(data=status, message="Status updated")


@router.delete("/{status_id}")
async def remove_status(
    status_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    ok, err = await delete_status(db, status_id)
    if not ok:
        return error_response(err or "Failed to delete status", status_code=400)
    return success_response(data={"deleted": True}, message="Status deleted")
