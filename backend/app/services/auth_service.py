import logging
import random
from datetime import datetime, timezone, timedelta
from typing import Optional

from bson import ObjectId
from passlib.context import CryptContext
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.user import user_doc_to_dict

logger = logging.getLogger(__name__)

OTP_EXPIRE_MINUTES = 10  # OTP valid for 10 minutes

_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    return _pwd.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return _pwd.verify(plain, hashed)


async def register_user(
    email: str,
    password: str,
    name: str,
    db: AsyncIOMotorDatabase,
) -> dict:
    """
    Creates a new user.  Raises ValueError if the email is already taken.
    Returns the inserted document (with '_id' populated).
    """
    if await db["users"].find_one({"email": email}):
        raise ValueError("Email already registered")

    doc = user_doc_to_dict(email, hash_password(password), name)
    result = await db["users"].insert_one(doc)
    doc["_id"] = result.inserted_id
    return doc


async def authenticate_user(
    email: str,
    password: str,
    db: AsyncIOMotorDatabase,
) -> dict:
    """
    Verifies credentials.  Raises ValueError on any failure so callers
    can return a generic 401 without leaking which field was wrong.
    Returns the user document on success.
    """
    user = await db["users"].find_one({"email": email})
    if not user or not verify_password(password, user["hashed_password"]):
        raise ValueError("Invalid credentials")
    if not user.get("is_active", True):
        raise ValueError("Account is disabled")
    return user


async def update_profile(
    user_id: str,
    name: Optional[str],
    email: Optional[str],
    db: AsyncIOMotorDatabase,
) -> dict:
    """
    Updates name and/or email for the given user.
    Raises ValueError if the new email is already taken by another account.
    Returns the updated user document.
    """
    oid = ObjectId(user_id)
    updates: dict = {"updated_at": datetime.now(timezone.utc)}

    if name is not None:
        updates["name"] = name

    if email is not None:
        existing = await db["users"].find_one({"email": email, "_id": {"$ne": oid}})
        if existing:
            raise ValueError("Email already in use by another account")
        updates["email"] = email

    if len(updates) == 1:
        # Only updated_at — nothing meaningful to change
        raise ValueError("Provide at least one field to update (name or email)")

    await db["users"].update_one({"_id": oid}, {"$set": updates})
    return await db["users"].find_one({"_id": oid})


async def update_password(
    user_id: str,
    current_password: str,
    new_password: str,
    db: AsyncIOMotorDatabase,
) -> None:
    """
    Verifies the current password then replaces it with the hashed new one.
    Also bumps token_version so any existing refresh tokens become invalid.
    Raises ValueError on wrong current password or same password reuse.
    """
    oid = ObjectId(user_id)
    user = await db["users"].find_one({"_id": oid})
    if not user:
        raise ValueError("User not found")

    if not verify_password(current_password, user["hashed_password"]):
        raise ValueError("Current password is incorrect")

    if verify_password(new_password, user["hashed_password"]):
        raise ValueError("New password must differ from the current password")

    new_version = user.get("token_version", 0) + 1
    await db["users"].update_one(
        {"_id": oid},
        {
            "$set": {
                "hashed_password": hash_password(new_password),
                "token_version": new_version,
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )


async def create_password_reset_otp(
    email: str,
    db: AsyncIOMotorDatabase,
) -> str | None:
    """
    Generate a 6-digit OTP for the given email address, persist it in
    ``password_resets`` (one active OTP per user via upsert), and return it.
    Returns None silently when the email isn't registered — prevents enumeration.
    """
    user = await db["users"].find_one({"email": email})
    if not user:
        return None

    otp = f"{random.SystemRandom().randint(100000, 999999)}"
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRE_MINUTES)

    # One active OTP per user — overwrite any previous pending reset
    await db["password_resets"].update_one(
        {"user_id": str(user["_id"])},
        {
            "$set": {
                "otp": otp,
                "email": email,
                "user_id": str(user["_id"]),
                "expires_at": expires_at,
                "used": False,
                "created_at": datetime.now(timezone.utc),
            }
        },
        upsert=True,
    )

    logger.info("Password reset OTP created for %s (expires in %d min)", email, OTP_EXPIRE_MINUTES)
    return otp


async def reset_password_with_otp(
    email: str,
    otp: str,
    new_password: str,
    db: AsyncIOMotorDatabase,
) -> None:
    """
    Validate the OTP for ``email`` and set a new password.
    Raises ValueError on invalid/expired/used OTP.
    """
    now = datetime.now(timezone.utc)
    record = await db["password_resets"].find_one({
        "email": email,
        "otp": otp,
        "used": False,
        "expires_at": {"$gt": now},
    })
    if not record:
        raise ValueError("The code is invalid or has expired. Please request a new one.")

    oid = ObjectId(record["user_id"])
    user = await db["users"].find_one({"_id": oid})
    if not user:
        raise ValueError("User not found.")

    if verify_password(new_password, user["hashed_password"]):
        raise ValueError("New password must differ from your current password.")

    new_version = user.get("token_version", 0) + 1
    await db["users"].update_one(
        {"_id": oid},
        {
            "$set": {
                "hashed_password": hash_password(new_password),
                "token_version": new_version,
                "updated_at": now,
            }
        },
    )

    # Mark OTP as used — prevents replay
    await db["password_resets"].update_one(
        {"email": email, "otp": otp},
        {"$set": {"used": True}},
    )
