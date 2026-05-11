from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError  # noqa: F401 — re-exported for callers
from app.config import settings

_ALG = settings.jwt_algorithm


def create_access_token(user_id: str, role_id: str = "") -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.access_token_expire_minutes
    )
    return jwt.encode(
        {"sub": user_id, "role_id": role_id, "exp": expire, "type": "access"},
        settings.jwt_secret_key,
        algorithm=_ALG,
    )


def create_refresh_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        days=settings.refresh_token_expire_days
    )
    return jwt.encode(
        {"sub": user_id, "exp": expire, "type": "refresh"},
        settings.jwt_secret_key,
        algorithm=_ALG,
    )


def decode_access_token(token: str) -> dict:
    payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[_ALG])
    if payload.get("type") != "access":
        raise JWTError("Token type mismatch — expected access token")
    return payload


def decode_refresh_token(token: str) -> dict:
    payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[_ALG])
    if payload.get("type") != "refresh":
        raise JWTError("Token type mismatch — expected refresh token")
    return payload
