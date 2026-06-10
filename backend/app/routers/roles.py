from fastapi import APIRouter, Depends, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.database import get_db
from app.middleware.auth import get_current_user
from app.schemas.role import CreateRoleRequest, UpdateRoleRequest
from app.services.role_service import (
    list_roles,
    list_roles_simple,
    get_role,
    create_role,
    update_role,
    delete_role,
)
from app.utils.response import error_response, success_response

router = APIRouter(prefix="/api/v1/roles", tags=["roles"])


def require_super_admin(current_user: dict = Depends(get_current_user)) -> dict:
    """Only Super Admin may access the roles management section."""
    role = current_user.get("_role") or {}
    if not (role.get("is_system_role") and role.get("role_name") == "Super Admin"):
        raise HTTPException(status_code=403, detail="Only Super Admin can manage roles.")
    return current_user


# ── List / simple list ────────────────────────────────────────────────────────

@router.get("")
async def get_roles(
    search: str = Query("", alias="search"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: dict = Depends(require_super_admin),
):
    result = await list_roles(db, search=search, page=page, limit=limit)
    return success_response(result, "Roles retrieved")


@router.get("/all")
async def get_roles_simple(
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Dropdown list — accessible to all authenticated users (needed for user creation forms)."""
    roles = await list_roles_simple(db)
    return success_response(roles, "Roles list retrieved")


# ── CRUD ──────────────────────────────────────────────────────────────────────

@router.post("", status_code=201)
async def create_role_endpoint(
    body: CreateRoleRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: dict = Depends(require_super_admin),
):
    try:
        role = await create_role(db, body)
    except ValueError as exc:
        return error_response(str(exc), status_code=409)
    return success_response(role, "Role created", status_code=201)


@router.get("/{role_id}")
async def get_role_endpoint(
    role_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: dict = Depends(require_super_admin),
):
    try:
        role = await get_role(db, role_id)
    except ValueError as exc:
        return error_response(str(exc), status_code=404)
    return success_response(role, "Role retrieved")


@router.put("/{role_id}")
async def update_role_endpoint(
    role_id: str,
    body: UpdateRoleRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: dict = Depends(require_super_admin),
):
    try:
        role = await update_role(db, role_id, body)
    except ValueError as exc:
        code = 404 if "not found" in str(exc) else 400
        return error_response(str(exc), status_code=code)
    return success_response(role, "Role updated")


@router.delete("/{role_id}", status_code=200)
async def delete_role_endpoint(
    role_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: dict = Depends(require_super_admin),
):
    try:
        await delete_role(db, role_id)
    except ValueError as exc:
        code = 404 if "not found" in str(exc) else 400
        return error_response(str(exc), status_code=code)
    return success_response(None, "Role deleted")
