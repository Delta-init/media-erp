from typing import Optional
from urllib.parse import quote_plus
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.config import settings
from app.database import get_db
from app.middleware.auth import get_current_user
from app.schemas.connector import ConnectorCreate, ConnectorUpdate, connector_to_out
from app.services.connector_service import (
    create_connector,
    delete_connector,
    get_connector,
    list_connectors,
    save_tokens,
    update_connector,
)
from app.utils.response import error_response, success_response

router = APIRouter(prefix="/api/v1/connectors", tags=["connectors"])


# ── CRUD ──────────────────────────────────────────────────────────────────────

@router.get("")
async def list_all(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    user_id = str(current_user["_id"])
    docs = await list_connectors(user_id, db)
    return success_response([connector_to_out(d) for d in docs], "Connectors retrieved")


@router.post("", status_code=201)
async def create(
    body: ConnectorCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    user_id = str(current_user["_id"])
    doc = await create_connector(user_id, body.platform, body.name, body.sync_frequency, db)
    return success_response(connector_to_out(doc), "Connector created", status_code=201)


@router.get("/{connector_id}")
async def get_one(
    connector_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    user_id = str(current_user["_id"])
    doc = await get_connector(connector_id, user_id, db)
    if not doc:
        return error_response("Connector not found", status_code=404)
    return success_response(connector_to_out(doc), "Connector retrieved")


@router.put("/{connector_id}")
async def update(
    connector_id: str,
    body: ConnectorUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    user_id = str(current_user["_id"])
    updates = body.model_dump(exclude_none=True)
    if not updates:
        return error_response("No fields to update", status_code=400)
    doc = await update_connector(connector_id, user_id, updates, db)
    if not doc:
        return error_response("Connector not found", status_code=404)
    return success_response(connector_to_out(doc), "Connector updated")


@router.delete("/{connector_id}", status_code=204)
async def delete(
    connector_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    user_id = str(current_user["_id"])
    deleted = await delete_connector(connector_id, user_id, db)
    if not deleted:
        raise HTTPException(status_code=404, detail="Connector not found")


# ── Google Ads OAuth ──────────────────────────────────────────────────────────
# NOTE: These routes have two path segments (/google_ads/auth, /google_ads/callback)
# so they do NOT conflict with the single-segment /{connector_id} routes above.

@router.get("/facebook_ads/auth")
async def facebook_ads_auth(
    connector_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Return a Facebook OAuth dialog URL for the given connector."""
    user_id = str(current_user["_id"])
    doc = await get_connector(connector_id, user_id, db)
    if not doc:
        return error_response("Connector not found", status_code=404)
    if doc["platform"] != "facebook_ads":
        return error_response("Connector platform is not facebook_ads", status_code=400)

    from app.platforms.facebook_ads import get_auth_url
    url = get_auth_url(connector_id, user_id)
    return success_response({"auth_url": url}, "Facebook Ads OAuth URL generated")


@router.get("/facebook_ads/callback")
async def facebook_ads_callback(
    state: str,
    code: Optional[str] = Query(default=None),
    error: Optional[str] = Query(default=None),
    error_description: Optional[str] = Query(default=None),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Facebook redirects here after user consents (or denies).
    PUBLIC — auth context carried via state nonce.
    """
    if error:
        return RedirectResponse(
            f"{settings.frontend_url}/connectors?oauth_error={quote_plus(error)}&platform=facebook_ads",
            status_code=302,
        )
    if not code:
        return RedirectResponse(
            f"{settings.frontend_url}/connectors?oauth_error=missing_code&platform=facebook_ads",
            status_code=302,
        )
    from app.platforms.facebook_ads import exchange_code
    try:
        token_data = await exchange_code(code, state)
    except ValueError as exc:
        return RedirectResponse(
            f"{settings.frontend_url}/connectors?oauth_error={str(exc)}&platform=facebook_ads",
            status_code=302,
        )

    await save_tokens(
        connector_id=token_data["connector_id"],
        user_id=token_data["user_id"],
        access_token=token_data["access_token"],
        refresh_token=token_data.get("refresh_token"),
        expires_at=token_data["expires_at"],
        platform_account_id=None,
        db=db,
    )
    return RedirectResponse(
        f"{settings.frontend_url}/connectors?connected=facebook_ads",
        status_code=302,
    )


@router.get("/facebook_pages/auth")
async def facebook_pages_auth(
    connector_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Return a Facebook OAuth URL scoped for Pages + Messenger."""
    user_id = str(current_user["_id"])
    doc = await get_connector(connector_id, user_id, db)
    if not doc:
        return error_response("Connector not found", status_code=404)
    if doc["platform"] != "facebook_pages":
        return error_response("Connector platform is not facebook_pages", status_code=400)

    from app.platforms.facebook_pages import get_auth_url
    url = get_auth_url(connector_id, user_id)
    return success_response({"auth_url": url}, "Facebook Pages OAuth URL generated")


@router.get("/facebook_pages/callback")
async def facebook_pages_callback(
    state: str,
    code: Optional[str] = Query(default=None),
    error: Optional[str] = Query(default=None),
    error_description: Optional[str] = Query(default=None),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Facebook redirects here after Pages consent. PUBLIC."""
    if error:
        return RedirectResponse(
            f"{settings.frontend_url}/connectors?oauth_error={quote_plus(error)}&platform=facebook_pages",
            status_code=302,
        )
    if not code:
        return RedirectResponse(
            f"{settings.frontend_url}/connectors?oauth_error=missing_code&platform=facebook_pages",
            status_code=302,
        )
    from app.platforms.facebook_pages import exchange_code
    try:
        token_data = await exchange_code(code, state)
    except ValueError as exc:
        return RedirectResponse(
            f"{settings.frontend_url}/connectors?oauth_error={str(exc)}&platform=facebook_pages",
            status_code=302,
        )
    await save_tokens(
        connector_id=token_data["connector_id"],
        user_id=token_data["user_id"],
        access_token=token_data["access_token"],
        refresh_token=token_data.get("refresh_token"),
        expires_at=token_data["expires_at"],
        platform_account_id=None,
        db=db,
    )
    return RedirectResponse(
        f"{settings.frontend_url}/connectors?connected=facebook_pages",
        status_code=302,
    )


@router.get("/instagram/auth")
async def instagram_auth(
    connector_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Return a Facebook OAuth URL scoped for Instagram."""
    user_id = str(current_user["_id"])
    doc = await get_connector(connector_id, user_id, db)
    if not doc:
        return error_response("Connector not found", status_code=404)
    if doc["platform"] != "instagram":
        return error_response("Connector platform is not instagram", status_code=400)

    from app.platforms.instagram import get_auth_url
    url = get_auth_url(connector_id, user_id)
    return success_response({"auth_url": url}, "Instagram OAuth URL generated")


@router.get("/instagram/callback")
async def instagram_callback(
    state: str,
    code: Optional[str] = Query(default=None),
    error: Optional[str] = Query(default=None),
    error_description: Optional[str] = Query(default=None),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Facebook redirects here after Instagram consent. PUBLIC."""
    if error:
        return RedirectResponse(
            f"{settings.frontend_url}/connectors?oauth_error={quote_plus(error)}&platform=instagram",
            status_code=302,
        )
    if not code:
        return RedirectResponse(
            f"{settings.frontend_url}/connectors?oauth_error=missing_code&platform=instagram",
            status_code=302,
        )
    from app.platforms.instagram import exchange_code
    try:
        token_data = await exchange_code(code, state)
    except ValueError as exc:
        return RedirectResponse(
            f"{settings.frontend_url}/connectors?oauth_error={str(exc)}&platform=instagram",
            status_code=302,
        )
    await save_tokens(
        connector_id=token_data["connector_id"],
        user_id=token_data["user_id"],
        access_token=token_data["access_token"],
        refresh_token=token_data.get("refresh_token"),
        expires_at=token_data["expires_at"],
        platform_account_id=None,
        db=db,
    )
    return RedirectResponse(
        f"{settings.frontend_url}/connectors?connected=instagram",
        status_code=302,
    )


@router.get("/tiktok_ads/auth")
async def tiktok_ads_auth(
    connector_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Return a TikTok Business OAuth consent URL for the given connector."""
    user_id = str(current_user["_id"])
    doc = await get_connector(connector_id, user_id, db)
    if not doc:
        return error_response("Connector not found", status_code=404)
    if doc["platform"] != "tiktok_ads":
        return error_response("Connector platform is not tiktok_ads", status_code=400)

    from app.platforms.tiktok_ads import get_auth_url
    url = get_auth_url(connector_id, user_id)
    return success_response({"auth_url": url}, "TikTok Ads OAuth URL generated")


@router.get("/tiktok_ads/callback")
async def tiktok_ads_callback(
    auth_code: str,
    state: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    TikTok redirects here after user consents.
    Note: TikTok sends `auth_code` (not `code`) as the query parameter.
    Exchanges auth_code → access token + advertiser_id, saves to connector,
    then redirects to the frontend.
    PUBLIC — auth context carried via state nonce.
    """
    from app.platforms.tiktok_ads import exchange_code
    from app.config import settings as _settings
    try:
        token_data = await exchange_code(auth_code, state)
    except ValueError as exc:
        return error_response(str(exc), status_code=400)

    await save_tokens(
        connector_id=token_data["connector_id"],
        user_id=token_data["user_id"],
        access_token=token_data["access_token"],
        refresh_token=token_data.get("refresh_token"),
        expires_at=token_data["expires_at"],
        platform_account_id=token_data.get("advertiser_id"),  # saved immediately from token response
        db=db,
    )
    return RedirectResponse(
        f"{settings.frontend_url}/connectors?connected=tiktok_ads",
        status_code=302,
    )


@router.get("/linkedin_ads/auth")
async def linkedin_ads_auth(
    connector_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Return a LinkedIn OAuth consent URL for the given connector."""
    user_id = str(current_user["_id"])
    doc = await get_connector(connector_id, user_id, db)
    if not doc:
        return error_response("Connector not found", status_code=404)
    if doc["platform"] != "linkedin_ads":
        return error_response("Connector platform is not linkedin_ads", status_code=400)

    from app.platforms.linkedin_ads import get_auth_url
    url = get_auth_url(connector_id, user_id)
    return success_response({"auth_url": url}, "LinkedIn Ads OAuth URL generated")


@router.get("/linkedin_ads/callback")
async def linkedin_ads_callback(
    state: str,
    code: Optional[str] = Query(default=None),
    error: Optional[str] = Query(default=None),
    error_description: Optional[str] = Query(default=None),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    LinkedIn redirects here after user consents (or denies).
    On denial / scope error, LinkedIn sends ?error=...&error_description=...
    instead of ?code=..., so both params are optional.
    PUBLIC — auth context carried via state nonce.
    """
    if error:
        return RedirectResponse(
            f"{settings.frontend_url}/connectors?oauth_error={quote_plus(error)}&platform=linkedin_ads",
            status_code=302,
        )

    if not code:
        return RedirectResponse(
            f"{settings.frontend_url}/connectors?oauth_error=missing_code&platform=linkedin_ads",
            status_code=302,
        )

    from app.platforms.linkedin_ads import exchange_code
    try:
        token_data = await exchange_code(code, state)
    except ValueError as exc:
        return RedirectResponse(
            f"{settings.frontend_url}/connectors?oauth_error={str(exc)}&platform=linkedin_ads",
            status_code=302,
        )

    await save_tokens(
        connector_id=token_data["connector_id"],
        user_id=token_data["user_id"],
        access_token=token_data["access_token"],
        refresh_token=token_data.get("refresh_token"),
        expires_at=token_data["expires_at"],
        platform_account_id=None,
        db=db,
    )
    return RedirectResponse(
        f"{settings.frontend_url}/connectors?connected=linkedin_ads",
        status_code=302,
    )


@router.get("/google_ads/auth")
async def google_ads_auth(
    connector_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Return a Google OAuth consent URL for the given connector."""
    user_id = str(current_user["_id"])
    doc = await get_connector(connector_id, user_id, db)
    if not doc:
        return error_response("Connector not found", status_code=404)
    if doc["platform"] != "google_ads":
        return error_response("Connector platform is not google_ads", status_code=400)

    from app.platforms.google_ads import get_auth_url
    url = get_auth_url(connector_id, user_id)
    return success_response({"auth_url": url}, "Google Ads OAuth URL generated")


@router.get("/ga4/auth")
async def ga4_auth(
    connector_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Return a Google OAuth consent URL scoped to GA4 for the given connector."""
    user_id = str(current_user["_id"])
    doc = await get_connector(connector_id, user_id, db)
    if not doc:
        return error_response("Connector not found", status_code=404)
    if doc["platform"] != "ga4":
        return error_response("Connector platform is not ga4", status_code=400)

    from app.platforms.ga4 import get_auth_url
    url = get_auth_url(connector_id, user_id)
    return success_response({"auth_url": url}, "GA4 OAuth URL generated")


@router.get("/ga4/callback")
async def ga4_callback(
    state: str,
    code: Optional[str] = Query(default=None),
    error: Optional[str] = Query(default=None),
    error_description: Optional[str] = Query(default=None),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Google redirects here after GA4 consent (or denial).
    PUBLIC — auth context carried via state nonce.
    """
    if error:
        return RedirectResponse(
            f"{settings.frontend_url}/connectors?oauth_error={quote_plus(error)}&platform=ga4",
            status_code=302,
        )
    if not code:
        return RedirectResponse(
            f"{settings.frontend_url}/connectors?oauth_error=missing_code&platform=ga4",
            status_code=302,
        )
    from app.platforms.ga4 import exchange_code
    try:
        token_data = await exchange_code(code, state)
    except ValueError as exc:
        return RedirectResponse(
            f"{settings.frontend_url}/connectors?oauth_error={str(exc)}&platform=ga4",
            status_code=302,
        )

    await save_tokens(
        connector_id=token_data["connector_id"],
        user_id=token_data["user_id"],
        access_token=token_data["access_token"],
        refresh_token=token_data.get("refresh_token"),
        expires_at=token_data["expires_at"],
        platform_account_id=None,
        db=db,
    )
    return RedirectResponse(
        f"{settings.frontend_url}/connectors?connected=ga4",
        status_code=302,
    )


@router.get("/google_ads/callback")
async def google_ads_callback(
    state: str,
    code: Optional[str] = Query(default=None),
    error: Optional[str] = Query(default=None),
    error_description: Optional[str] = Query(default=None),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Google redirects here after user consents (or denies).
    PUBLIC — auth context carried via state nonce.
    """
    if error:
        return RedirectResponse(
            f"{settings.frontend_url}/connectors?oauth_error={quote_plus(error)}&platform=google_ads",
            status_code=302,
        )
    if not code:
        return RedirectResponse(
            f"{settings.frontend_url}/connectors?oauth_error=missing_code&platform=google_ads",
            status_code=302,
        )
    from app.platforms.google_ads import exchange_code
    try:
        token_data = await exchange_code(code, state)
    except ValueError as exc:
        return RedirectResponse(
            f"{settings.frontend_url}/connectors?oauth_error={str(exc)}&platform=google_ads",
            status_code=302,
        )

    await save_tokens(
        connector_id=token_data["connector_id"],
        user_id=token_data["user_id"],
        access_token=token_data["access_token"],
        refresh_token=token_data.get("refresh_token"),
        expires_at=token_data["expires_at"],
        platform_account_id=None,
        db=db,
    )
    return RedirectResponse(
        f"{settings.frontend_url}/connectors?connected=google_ads",
        status_code=302,
    )
