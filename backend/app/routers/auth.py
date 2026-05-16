import logging

from bson import ObjectId
from fastapi import APIRouter, Depends
from jose import JWTError
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)

from app.database import get_db
from app.middleware.auth import get_current_user
from app.config import settings
from app.schemas.auth import (
    ForgotPasswordRequest,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    ResetPasswordRequest,
    UpdatePasswordRequest,
    UpdateProfileRequest,
)
from app.services.auth_service import (
    authenticate_user,
    create_password_reset_otp,
    register_user,
    reset_password_with_otp,
    update_password,
    update_profile,
)
from app.utils.email import send_otp_email
from app.utils.jwt import create_access_token, create_refresh_token, decode_refresh_token
from app.utils.response import error_response, success_response

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


async def _fetch_role(db: AsyncIOMotorDatabase, role_id: str) -> dict | None:
    """Fetch role document and serialize it."""
    if not role_id:
        return None
    try:
        role_doc = await db["roles"].find_one({"_id": ObjectId(role_id)})
    except Exception:
        return None
    if not role_doc:
        return None
    from app.services.role_service import _serialize_role
    return _serialize_role(role_doc)


async def _token_payload(user: dict, db: AsyncIOMotorDatabase) -> dict:
    user_id = str(user["_id"])
    role_id = user.get("role_id", "")
    role_data = await _fetch_role(db, role_id)
    return {
        "access_token": create_access_token(user_id, role_id),
        "refresh_token": create_refresh_token(user_id),
        "token_type": "bearer",
        "user": {
            "id": user_id,
            "email": user["email"],
            "name": user["name"],
            "role": role_data,
            "role_id": role_id,
            "designation": user.get("designation", ""),
            "status": user.get("status", "active"),
            "plan": user.get("plan", "free"),
        },
    }


@router.post("/register", status_code=201)
async def register(body: RegisterRequest, db: AsyncIOMotorDatabase = Depends(get_db)):
    try:
        user = await register_user(body.email, body.password, body.name, db)
    except ValueError as exc:
        return error_response(str(exc), status_code=409)
    return success_response(await _token_payload(user, db), "Registration successful", status_code=201)


@router.post("/login")
async def login(body: LoginRequest, db: AsyncIOMotorDatabase = Depends(get_db)):
    try:
        user = await authenticate_user(body.email, body.password, db)
    except ValueError:
        return error_response("Invalid email or password", status_code=401)
    return success_response(await _token_payload(user, db), "Login successful")


@router.post("/refresh")
async def refresh(body: RefreshRequest, db: AsyncIOMotorDatabase = Depends(get_db)):
    try:
        payload = decode_refresh_token(body.refresh_token)
    except JWTError:
        return error_response("Invalid or expired refresh token", status_code=401)
    user_id = payload.get("sub")
    try:
        oid = ObjectId(user_id)
    except Exception:
        return error_response("Invalid token subject", status_code=401)
    user = await db["users"].find_one({"_id": oid})
    if not user or not user.get("is_active", True):
        return error_response("User not found or inactive", status_code=401)
    return success_response(await _token_payload(user, db), "Token refreshed")


@router.get("/me")
async def me(current_user: dict = Depends(get_current_user), db: AsyncIOMotorDatabase = Depends(get_db)):
    role_id = current_user.get("role_id", "")
    role_data = await _fetch_role(db, role_id)
    return success_response(
        {
            "id": str(current_user["_id"]),
            "email": current_user["email"],
            "name": current_user["name"],
            "role": role_data,
            "role_id": role_id,
            "designation": current_user.get("designation", ""),
            "status": current_user.get("status", "active"),
            "plan": current_user.get("plan", "free"),
        },
        "User profile retrieved",
    )


@router.post("/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    return success_response(None, "Logged out successfully")


@router.put("/me")
async def update_me(
    body: UpdateProfileRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    if body.name is None and body.email is None:
        return error_response("Provide at least one field to update (name or email)", status_code=422)
    try:
        updated = await update_profile(str(current_user["_id"]), body.name, body.email, db)
    except ValueError as exc:
        return error_response(str(exc), status_code=409)
    role_id = updated.get("role_id", "")
    role_data = await _fetch_role(db, role_id)
    return success_response(
        {
            "id": str(updated["_id"]),
            "email": updated["email"],
            "name": updated["name"],
            "role": role_data,
            "role_id": role_id,
            "designation": updated.get("designation", ""),
            "status": updated.get("status", "active"),
            "plan": updated.get("plan", "free"),
        },
        "Profile updated successfully",
    )


@router.post("/forgot-password")
async def forgot_password(
    body: ForgotPasswordRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Send a 6-digit OTP to the user's email address.
    Always returns 200 — never reveals whether the email is registered.
    """
    otp = await create_password_reset_otp(body.email, db)
    if otp:
        try:
            await send_otp_email(body.email, otp)
            logger.info("OTP email dispatched to %s", body.email)
        except Exception as exc:
            logger.error("Failed to send OTP email to %s: %s", body.email, exc)
            # Return a generic error so the user knows something went wrong
            return error_response(
                "Could not send the OTP email. Please try again later.",
                status_code=503,
            )

    return success_response(
        {"message": "If that email is registered, a reset code has been sent."},
        "OTP sent",
    )


@router.post("/reset-password")
async def reset_password(
    body: ResetPasswordRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Validate the OTP and set a new password."""
    try:
        await reset_password_with_otp(body.email, body.otp, body.new_password, db)
    except ValueError as exc:
        return error_response(str(exc), status_code=400)
    return success_response(None, "Password reset successfully. You can now log in.")


@router.put("/password")
async def change_password(
    body: UpdatePasswordRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    try:
        await update_password(str(current_user["_id"]), body.current_password, body.new_password, db)
    except ValueError as exc:
        status = 400 if "incorrect" in str(exc) or "differ" in str(exc) else 404
        return error_response(str(exc), status_code=status)
    return success_response(
        None,
        "Password changed successfully. Please log in again with your new password.",
    )
