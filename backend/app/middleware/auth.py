from bson import ObjectId
from bson.errors import InvalidId
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.database import get_db
from app.utils.jwt import decode_access_token

_bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    """
    FastAPI dependency — validates the Bearer JWT or API key and returns the user document
    with the role document attached as '_role'.

    Supported Authorization schemes:
      Authorization: Bearer <jwt>
      Authorization: ApiKey merp_<key>

    Raises 401 on any auth failure so callers never see a partial state.
    """
    unauth = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # ── Check for ApiKey scheme first (non-standard, extract manually) ─────────
    auth_header = request.headers.get("Authorization", "")
    if auth_header.lower().startswith("apikey "):
        raw_key = auth_header[7:].strip()
        from app.routers.api_keys import authenticate_api_key
        user = await authenticate_api_key(raw_key, db)
        if user is None:
            raise unauth
        return user

    # ── Fall back to standard Bearer JWT ───────────────────────────────────────
    if credentials is None:
        raise unauth
    try:
        payload = decode_access_token(credentials.credentials)
        user_id: str = payload.get("sub", "")
        object_id = ObjectId(user_id)
    except (JWTError, InvalidId, ValueError):
        raise unauth

    user = await db["users"].find_one({"_id": object_id})
    if user is None or not user.get("is_active", True):
        raise unauth

    # Attach role document for permission checks (live fetch — always current)
    role_id = user.get("role_id")
    if role_id:
        try:
            role_doc = await db["roles"].find_one({"_id": ObjectId(role_id)})
            user["_role"] = role_doc
        except Exception:
            user["_role"] = None
    else:
        user["_role"] = None

    return user
