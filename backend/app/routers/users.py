from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.database import get_db
from app.middleware.auth import get_current_user
from app.middleware.permissions import check_permission
from app.schemas.user_admin import CreateUserRequest, UpdateUserRequest
from app.services.user_service import (
    list_users,
    get_user,
    create_user,
    update_user,
    delete_user,
)
from app.utils.response import error_response, success_response

router = APIRouter(prefix="/api/v1/users", tags=["users"])


@router.get("")
async def get_users(
    search: str = Query("", alias="search"),
    status: str = Query("", alias="status"),
    role_id: str = Query("", alias="role_id"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: dict = Depends(check_permission("users", "view")),
):
    result = await list_users(db, search=search, status=status, role_id=role_id, page=page, limit=limit)
    return success_response(result, "Users retrieved")


@router.post("", status_code=201)
async def create_user_endpoint(
    body: CreateUserRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(check_permission("users", "create")),
):
    try:
        user = await create_user(db, body, caller=current_user)
    except ValueError as exc:
        status_code = 403 if "cannot assign" in str(exc).lower() else 409
        return error_response(str(exc), status_code=status_code)
    return success_response(user, "User created", status_code=201)


@router.get("/{user_id}")
async def get_user_endpoint(
    user_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    # Allow self-access without permission check
    is_self = str(current_user["_id"]) == user_id
    if not is_self:
        # Check permission
        from app.middleware.permissions import _has_permission
        if not _has_permission(current_user, "users", "view"):
            return error_response("No 'view' permission on 'users'", status_code=403)
    try:
        user = await get_user(db, user_id)
    except ValueError as exc:
        return error_response(str(exc), status_code=404)
    return success_response(user, "User retrieved")


@router.put("/{user_id}")
async def update_user_endpoint(
    user_id: str,
    body: UpdateUserRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(check_permission("users", "edit")),
):
    try:
        user = await update_user(db, user_id, body, caller=current_user)
    except ValueError as exc:
        if "cannot assign" in str(exc).lower():
            code = 403
        elif "not found" in str(exc).lower():
            code = 404
        else:
            code = 409
        return error_response(str(exc), status_code=code)
    return success_response(user, "User updated")


@router.delete("/{user_id}")
async def delete_user_endpoint(
    user_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(check_permission("users", "delete")),
):
    try:
        await delete_user(db, user_id, str(current_user["_id"]))
    except ValueError as exc:
        code = 404 if "not found" in str(exc) else 400
        return error_response(str(exc), status_code=code)
    return success_response(None, "User deleted")
