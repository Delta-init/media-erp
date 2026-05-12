from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel

from app.database import get_db
from app.middleware.auth import get_current_user
from app.services.connector_service import get_connector, get_decrypted_tokens
from app.utils.response import error_response, success_response

router = APIRouter(prefix="/api/v1/social", tags=["social"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class FacebookPostBody(BaseModel):
    connector_id: str
    page_id: str
    message: str
    link: str | None = None
    image_url: str | None = None


class InstagramPostBody(BaseModel):
    connector_id: str
    ig_id: str
    page_token: str
    caption: str
    image_url: str | None = None
    video_url: str | None = None


class DMBody(BaseModel):
    connector_id: str
    page_id: str
    recipient_id: str
    message: str


class InstagramDMBody(BaseModel):
    connector_id: str
    ig_id: str
    page_token: str
    recipient_id: str
    message: str


# ── Facebook Pages ────────────────────────────────────────────────────────────

@router.get("/facebook/pages")
async def list_facebook_pages(
    connector_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """List Facebook Pages the connector token has access to."""
    user_id = str(current_user["_id"])
    connector = await get_connector(connector_id, user_id, db)
    if not connector:
        return error_response("Connector not found", status_code=404)
    if connector["platform"] != "facebook_pages":
        return error_response("Connector is not a facebook_pages connector", status_code=400)
    if connector.get("status") != "connected":
        return error_response("Connector is not connected", status_code=400)

    tokens = get_decrypted_tokens(connector)
    from app.platforms.facebook_pages import get_pages
    try:
        pages = await get_pages(tokens["access_token"])
    except Exception as exc:
        return error_response(f"Failed to fetch pages: {exc}", status_code=502)
    return success_response(pages, "Pages retrieved")


@router.post("/facebook/post", status_code=201)
async def publish_facebook_post(
    body: FacebookPostBody,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Publish a post to a Facebook Page."""
    user_id = str(current_user["_id"])
    connector = await get_connector(body.connector_id, user_id, db)
    if not connector:
        return error_response("Connector not found", status_code=404)
    if connector["platform"] != "facebook_pages":
        return error_response("Connector is not a facebook_pages connector", status_code=400)
    if connector.get("status") != "connected":
        return error_response("Connector is not connected", status_code=400)

    tokens = get_decrypted_tokens(connector)
    from app.platforms.facebook_pages import get_pages, publish_post
    try:
        pages = await get_pages(tokens["access_token"])
    except Exception as exc:
        return error_response(f"Failed to fetch pages: {exc}", status_code=502)

    page = next((p for p in pages if p["id"] == body.page_id), None)
    if not page:
        return error_response("Page not found in connected pages", status_code=404)

    try:
        result = await publish_post(
            page_id=body.page_id,
            page_token=page["access_token"],
            message=body.message,
            link=body.link,
            image_url=body.image_url,
        )
    except Exception as exc:
        return error_response(f"Failed to publish post: {exc}", status_code=502)
    return success_response(result, "Post published", status_code=201)


@router.post("/facebook/dm", status_code=201)
async def send_facebook_dm(
    body: DMBody,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Send a Messenger DM from a Facebook Page."""
    user_id = str(current_user["_id"])
    connector = await get_connector(body.connector_id, user_id, db)
    if not connector:
        return error_response("Connector not found", status_code=404)
    if connector["platform"] != "facebook_pages":
        return error_response("Connector is not a facebook_pages connector", status_code=400)
    if connector.get("status") != "connected":
        return error_response("Connector is not connected", status_code=400)

    tokens = get_decrypted_tokens(connector)
    from app.platforms.facebook_pages import get_pages, send_dm
    try:
        pages = await get_pages(tokens["access_token"])
    except Exception as exc:
        return error_response(f"Failed to fetch pages: {exc}", status_code=502)

    page = next((p for p in pages if p["id"] == body.page_id), None)
    if not page:
        return error_response("Page not found in connected pages", status_code=404)

    try:
        result = await send_dm(
            page_id=body.page_id,
            page_token=page["access_token"],
            recipient_id=body.recipient_id,
            message=body.message,
        )
    except Exception as exc:
        return error_response(f"Failed to send DM: {exc}", status_code=502)
    return success_response(result, "DM sent", status_code=201)


# ── Instagram ─────────────────────────────────────────────────────────────────

@router.get("/instagram/accounts")
async def list_instagram_accounts(
    connector_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """List Instagram Business accounts linked to the connector."""
    user_id = str(current_user["_id"])
    connector = await get_connector(connector_id, user_id, db)
    if not connector:
        return error_response("Connector not found", status_code=404)
    if connector["platform"] != "instagram":
        return error_response("Connector is not an instagram connector", status_code=400)
    if connector.get("status") != "connected":
        return error_response("Connector is not connected", status_code=400)

    tokens = get_decrypted_tokens(connector)
    from app.platforms.instagram import get_instagram_accounts
    try:
        accounts = await get_instagram_accounts(tokens["access_token"])
    except Exception as exc:
        return error_response(f"Failed to fetch accounts: {exc}", status_code=502)
    return success_response(accounts, "Instagram accounts retrieved")


@router.post("/instagram/post", status_code=201)
async def publish_instagram_post(
    body: InstagramPostBody,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Publish a post to Instagram. image_url must be a public URL."""
    user_id = str(current_user["_id"])
    connector = await get_connector(body.connector_id, user_id, db)
    if not connector:
        return error_response("Connector not found", status_code=404)
    if connector["platform"] != "instagram":
        return error_response("Connector is not an instagram connector", status_code=400)
    if connector.get("status") != "connected":
        return error_response("Connector is not connected", status_code=400)

    from app.platforms.instagram import publish_post
    try:
        result = await publish_post(
            ig_id=body.ig_id,
            page_token=body.page_token,
            caption=body.caption,
            image_url=body.image_url,
            video_url=body.video_url,
        )
    except ValueError as exc:
        return error_response(str(exc), status_code=400)
    except Exception as exc:
        return error_response(f"Failed to publish post: {exc}", status_code=502)
    return success_response(result, "Instagram post published", status_code=201)


@router.post("/instagram/dm", status_code=201)
async def send_instagram_dm(
    body: InstagramDMBody,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Send an Instagram DM. Recipient must have messaged you first."""
    user_id = str(current_user["_id"])
    connector = await get_connector(body.connector_id, user_id, db)
    if not connector:
        return error_response("Connector not found", status_code=404)
    if connector["platform"] != "instagram":
        return error_response("Connector is not an instagram connector", status_code=400)
    if connector.get("status") != "connected":
        return error_response("Connector is not connected", status_code=400)

    from app.platforms.instagram import send_dm
    try:
        result = await send_dm(
            ig_id=body.ig_id,
            page_token=body.page_token,
            recipient_id=body.recipient_id,
            message=body.message,
        )
    except Exception as exc:
        return error_response(f"Failed to send DM: {exc}", status_code=502)
    return success_response(result, "Instagram DM sent", status_code=201)
