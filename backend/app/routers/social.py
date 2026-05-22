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


class InstagramLoginPostBody(BaseModel):
    connector_id: str
    caption: str
    image_url: str | None = None
    video_url: str | None = None


class InstagramLoginDMBody(BaseModel):
    connector_id: str
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


# ── Facebook Conversations (Inbox) ───────────────────────────────────────────

@router.get("/facebook/conversations")
async def list_facebook_conversations(
    connector_id: str,
    page_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """List Messenger conversations for a Facebook Page (inbox)."""
    user_id = str(current_user["_id"])
    connector = await get_connector(connector_id, user_id, db)
    if not connector:
        return error_response("Connector not found", status_code=404)
    if connector["platform"] != "facebook_pages":
        return error_response("Connector is not a facebook_pages connector", status_code=400)
    if connector.get("status") != "connected":
        return error_response("Connector is not connected", status_code=400)

    tokens = get_decrypted_tokens(connector)
    from app.platforms.facebook_pages import get_pages, get_conversations
    try:
        pages = await get_pages(tokens["access_token"])
        page = next((p for p in pages if p["id"] == page_id), None)
        if not page:
            return error_response("Page not found in connected pages", status_code=404)
        conversations = await get_conversations(page_id, page["access_token"])
    except Exception as exc:
        return error_response(f"Failed to fetch conversations: {exc}", status_code=502)
    return success_response(conversations, "Conversations retrieved")


@router.get("/facebook/conversations/{conversation_id}/messages")
async def get_facebook_conversation_messages(
    conversation_id: str,
    connector_id: str,
    page_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Get messages inside a Messenger conversation."""
    user_id = str(current_user["_id"])
    connector = await get_connector(connector_id, user_id, db)
    if not connector:
        return error_response("Connector not found", status_code=404)
    if connector["platform"] != "facebook_pages":
        return error_response("Connector is not a facebook_pages connector", status_code=400)
    if connector.get("status") != "connected":
        return error_response("Connector is not connected", status_code=400)

    tokens = get_decrypted_tokens(connector)
    from app.platforms.facebook_pages import get_pages, get_conversation_messages
    try:
        pages = await get_pages(tokens["access_token"])
        page = next((p for p in pages if p["id"] == page_id), None)
        if not page:
            return error_response("Page not found in connected pages", status_code=404)
        messages = await get_conversation_messages(conversation_id, page["access_token"])
    except Exception as exc:
        return error_response(f"Failed to fetch messages: {exc}", status_code=502)
    return success_response(messages, "Messages retrieved")


# ── Instagram Conversations (via instagram platform / Facebook OAuth) ─────────

@router.get("/instagram/conversations")
async def list_instagram_conversations(
    connector_id: str,
    ig_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """List Instagram Direct conversations for a Business account."""
    user_id = str(current_user["_id"])
    connector = await get_connector(connector_id, user_id, db)
    if not connector:
        return error_response("Connector not found", status_code=404)
    if connector["platform"] != "instagram":
        return error_response("Connector is not an instagram connector", status_code=400)
    if connector.get("status") != "connected":
        return error_response("Connector is not connected", status_code=400)

    tokens = get_decrypted_tokens(connector)
    from app.platforms.instagram import get_instagram_accounts, get_conversations
    try:
        accounts = await get_instagram_accounts(tokens["access_token"])
        account = next((a for a in accounts if a["ig_id"] == ig_id), None)
        if not account:
            return error_response("Instagram account not found for this connector", status_code=404)
        conversations = await get_conversations(ig_id, account["page_token"])
    except Exception as exc:
        return error_response(f"Failed to fetch conversations: {exc}", status_code=502)
    return success_response(conversations, "Instagram conversations retrieved")


@router.get("/instagram/conversations/{conversation_id}/messages")
async def get_instagram_conversation_messages(
    conversation_id: str,
    connector_id: str,
    ig_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Get messages inside an Instagram Direct conversation."""
    user_id = str(current_user["_id"])
    connector = await get_connector(connector_id, user_id, db)
    if not connector:
        return error_response("Connector not found", status_code=404)
    if connector["platform"] != "instagram":
        return error_response("Connector is not an instagram connector", status_code=400)
    if connector.get("status") != "connected":
        return error_response("Connector is not connected", status_code=400)

    tokens = get_decrypted_tokens(connector)
    from app.platforms.instagram import get_instagram_accounts, get_conversation_messages
    try:
        accounts = await get_instagram_accounts(tokens["access_token"])
        account = next((a for a in accounts if a["ig_id"] == ig_id), None)
        if not account:
            return error_response("Instagram account not found for this connector", status_code=404)
        messages = await get_conversation_messages(conversation_id, account["page_token"])
    except Exception as exc:
        return error_response(f"Failed to fetch messages: {exc}", status_code=502)
    return success_response(messages, "Messages retrieved")


# ── Instagram Login ───────────────────────────────────────────────────────────

@router.get("/instagram_login/account")
async def get_instagram_login_account(
    connector_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Return the IG profile linked to this Instagram Login connector."""
    user_id = str(current_user["_id"])
    connector = await get_connector(connector_id, user_id, db)
    if not connector:
        return error_response("Connector not found", status_code=404)
    if connector["platform"] != "instagram_login":
        return error_response("Connector is not an instagram_login connector", status_code=400)
    if connector.get("status") != "connected":
        return error_response("Connector is not connected", status_code=400)

    tokens = get_decrypted_tokens(connector)
    if tokens.get("access_token") == "demo_token_placeholder":
        return success_response({
            "id": connector.get("platform_account_id", "ig_demo_account"),
            "name": "Demo Instagram Account",
            "username": "demo_account",
            "followers_count": 12400,
            "media_count": 48,
        }, "Instagram account retrieved")
    from app.platforms.instagram_login import get_user_info
    try:
        info = await get_user_info(tokens["access_token"])
    except Exception as exc:
        return error_response(f"Failed to fetch account info: {exc}", status_code=502)
    # Attach ig_user_id from stored platform_account_id as fallback
    if "id" not in info and connector.get("platform_account_id"):
        info["id"] = connector["platform_account_id"]
    return success_response(info, "Instagram account retrieved")


@router.post("/instagram_login/post", status_code=201)
async def publish_instagram_login_post(
    body: InstagramLoginPostBody,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Publish a post via Instagram Login. image_url must be a public URL."""
    user_id = str(current_user["_id"])
    connector = await get_connector(body.connector_id, user_id, db)
    if not connector:
        return error_response("Connector not found", status_code=404)
    if connector["platform"] != "instagram_login":
        return error_response("Connector is not an instagram_login connector", status_code=400)
    if connector.get("status") != "connected":
        return error_response("Connector is not connected", status_code=400)

    ig_user_id = connector.get("platform_account_id")
    if not ig_user_id:
        return error_response("Instagram user ID not found — please reconnect the connector", status_code=400)

    tokens = get_decrypted_tokens(connector)
    from app.platforms.instagram_login import publish_post
    try:
        result = await publish_post(
            ig_user_id=ig_user_id,
            access_token=tokens["access_token"],
            caption=body.caption,
            image_url=body.image_url,
            video_url=body.video_url,
        )
    except ValueError as exc:
        return error_response(str(exc), status_code=400)
    except Exception as exc:
        return error_response(f"Failed to publish post: {exc}", status_code=502)
    return success_response(result, "Instagram post published", status_code=201)


@router.get("/instagram_login/conversations")
async def list_instagram_login_conversations(
    connector_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """List Instagram Direct conversations (inbox) for an Instagram Login connector."""
    user_id = str(current_user["_id"])
    connector = await get_connector(connector_id, user_id, db)
    if not connector:
        return error_response("Connector not found", status_code=404)
    if connector["platform"] != "instagram_login":
        return error_response("Connector is not an instagram_login connector", status_code=400)
    if connector.get("status") != "connected":
        return error_response("Connector is not connected", status_code=400)

    ig_user_id = connector.get("platform_account_id")
    if not ig_user_id:
        return error_response("Instagram user ID not found — please reconnect the connector", status_code=400)

    tokens = get_decrypted_tokens(connector)
    if tokens.get("access_token") == "demo_token_placeholder":
        return success_response([], "Conversations retrieved")
    from app.platforms.instagram_login import get_conversations
    try:
        conversations = await get_conversations(ig_user_id, tokens["access_token"])
    except Exception as exc:
        return error_response(f"Failed to fetch conversations: {exc}", status_code=502)
    return success_response(conversations, "Conversations retrieved")


@router.get("/instagram_login/conversations/{conversation_id}/messages")
async def get_instagram_login_conversation_messages(
    conversation_id: str,
    connector_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Get messages inside an Instagram Direct conversation."""
    user_id = str(current_user["_id"])
    connector = await get_connector(connector_id, user_id, db)
    if not connector:
        return error_response("Connector not found", status_code=404)
    if connector["platform"] != "instagram_login":
        return error_response("Connector is not an instagram_login connector", status_code=400)
    if connector.get("status") != "connected":
        return error_response("Connector is not connected", status_code=400)

    tokens = get_decrypted_tokens(connector)
    from app.platforms.instagram_login import get_conversation_messages
    try:
        messages = await get_conversation_messages(conversation_id, tokens["access_token"])
    except Exception as exc:
        return error_response(f"Failed to fetch messages: {exc}", status_code=502)
    return success_response(messages, "Messages retrieved")


@router.post("/instagram_login/dm", status_code=201)
async def send_instagram_login_dm(
    body: InstagramLoginDMBody,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Send an Instagram DM via Instagram Login. Recipient must have messaged you first."""
    user_id = str(current_user["_id"])
    connector = await get_connector(body.connector_id, user_id, db)
    if not connector:
        return error_response("Connector not found", status_code=404)
    if connector["platform"] != "instagram_login":
        return error_response("Connector is not an instagram_login connector", status_code=400)
    if connector.get("status") != "connected":
        return error_response("Connector is not connected", status_code=400)

    ig_user_id = connector.get("platform_account_id")
    if not ig_user_id:
        return error_response("Instagram user ID not found — please reconnect the connector", status_code=400)

    tokens = get_decrypted_tokens(connector)
    from app.platforms.instagram_login import send_dm
    try:
        result = await send_dm(
            ig_user_id=ig_user_id,
            access_token=tokens["access_token"],
            recipient_id=body.recipient_id,
            message=body.message,
        )
    except Exception as exc:
        return error_response(f"Failed to send DM: {exc}", status_code=502)
    return success_response(result, "Instagram DM sent", status_code=201)


# ── Posts / Media ─────────────────────────────────────────────────────────────

@router.get("/instagram_login/posts")
async def get_instagram_login_posts(
    connector_id: str,
    limit: int = 20,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Return media posts for an Instagram Login connector."""
    user_id = str(current_user["_id"])
    connector = await get_connector(connector_id, user_id, db)
    if not connector:
        return error_response("Connector not found", status_code=404)
    if connector["platform"] != "instagram_login":
        return error_response("Not an instagram_login connector", status_code=400)
    if connector.get("status") != "connected":
        return error_response("Connector is not connected", status_code=400)
    ig_user_id = connector.get("platform_account_id")
    if not ig_user_id:
        return error_response("Instagram user ID not found — please reconnect", status_code=400)
    tokens = get_decrypted_tokens(connector)
    if tokens.get("access_token") == "demo_token_placeholder":
        from datetime import datetime, timezone, timedelta
        now = datetime.now(timezone.utc)
        demo_posts = [
            {
                "id": f"demo_post_{i}",
                "caption": cap,
                "media_type": "IMAGE",
                "media_url": f"https://picsum.photos/seed/ig{i}/800/800",
                "thumbnail_url": None,
                "timestamp": (now - timedelta(days=i * 3)).isoformat(),
                "like_count": likes,
                "comments_count": comments,
                "permalink": f"https://www.instagram.com/p/demo{i}/",
            }
            for i, (cap, likes, comments) in enumerate([
                ("Excited to share our latest product launch! 🚀 #marketing #growth", 847, 43),
                ("Behind the scenes at our team offsite 🌟 #teamwork #culture", 623, 28),
                ("New blog post: 5 strategies that tripled our engagement 📈", 512, 67),
                ("Thank you for 10K followers! Your support means everything ❤️", 1204, 91),
                ("Q3 results are in — and we're blown away 🎉 #milestones", 389, 22),
                ("Meet the team powering our growth 💪 #peoplefirst", 445, 35),
            ], 1)
        ]
        return success_response(demo_posts[:limit], "Posts retrieved")
    from app.platforms.instagram_login import get_media
    try:
        posts = await get_media(ig_user_id, tokens["access_token"], limit=limit)
    except Exception as exc:
        return error_response(f"Failed to fetch posts: {exc}", status_code=502)
    return success_response(posts, "Posts retrieved")


@router.get("/instagram_login/posts/{post_id}/comments")
async def get_instagram_login_post_comments(
    post_id: str,
    connector_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Return comments for a specific Instagram post."""
    user_id = str(current_user["_id"])
    connector = await get_connector(connector_id, user_id, db)
    if not connector:
        return error_response("Connector not found", status_code=404)
    if connector["platform"] != "instagram_login":
        return error_response("Not an instagram_login connector", status_code=400)
    if connector.get("status") != "connected":
        return error_response("Connector is not connected", status_code=400)
    tokens = get_decrypted_tokens(connector)
    from app.platforms.instagram_login import get_media_comments
    try:
        comments = await get_media_comments(post_id, tokens["access_token"])
    except Exception as exc:
        return error_response(f"Failed to fetch comments: {exc}", status_code=502)
    return success_response(comments, "Comments retrieved")


@router.get("/facebook/posts")
async def get_facebook_page_posts(
    connector_id: str,
    page_id: str,
    limit: int = 20,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Return posts for a Facebook Page."""
    user_id = str(current_user["_id"])
    connector = await get_connector(connector_id, user_id, db)
    if not connector:
        return error_response("Connector not found", status_code=404)
    if connector["platform"] != "facebook_pages":
        return error_response("Not a facebook_pages connector", status_code=400)
    if connector.get("status") != "connected":
        return error_response("Connector is not connected", status_code=400)
    tokens = get_decrypted_tokens(connector)
    from app.platforms.facebook_pages import get_pages, get_page_posts
    try:
        pages = await get_pages(tokens["access_token"])
        page = next((p for p in pages if p["id"] == page_id), None)
        if not page:
            return error_response("Page not found", status_code=404)
        posts = await get_page_posts(page_id, page["access_token"], limit=limit)
    except Exception as exc:
        return error_response(f"Failed to fetch posts: {exc}", status_code=502)
    return success_response(posts, "Posts retrieved")


@router.get("/webhook-messages")
async def get_webhook_messages(
    page_id: str | None = None,
    limit: int = 50,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Return DM messages that arrived via Meta webhook and were persisted locally.
    Useful for surfacing real-time inbound messages even before the API is polled.
    """
    user_id = str(current_user["_id"])
    query: dict = {"user_id": user_id}
    if page_id:
        query["page_id"] = page_id
    cursor = db["social_messages"].find(query).sort("created_at", -1).limit(limit)
    docs = await cursor.to_list(limit)
    messages = []
    for d in docs:
        messages.append({
            "id":           str(d["_id"]),
            "mid":          d.get("mid"),
            "platform":     d.get("platform"),
            "page_id":      d.get("page_id"),
            "sender_id":    d.get("sender_id"),
            "recipient_id": d.get("recipient_id"),
            "text":         d.get("text"),
            "direction":    d.get("direction", "inbound"),
            "created_at":   d["created_at"].isoformat() if d.get("created_at") else None,
        })
    return success_response(messages, "Webhook messages retrieved")


@router.get("/facebook/posts/{post_id}/comments")
async def get_facebook_post_comments(
    post_id: str,
    connector_id: str,
    page_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Return comments for a specific Facebook Page post."""
    user_id = str(current_user["_id"])
    connector = await get_connector(connector_id, user_id, db)
    if not connector:
        return error_response("Connector not found", status_code=404)
    if connector.get("status") != "connected":
        return error_response("Connector is not connected", status_code=400)
    tokens = get_decrypted_tokens(connector)
    from app.platforms.facebook_pages import get_pages, get_post_comments
    try:
        pages = await get_pages(tokens["access_token"])
        page = next((p for p in pages if p["id"] == page_id), None)
        if not page:
            return error_response("Page not found", status_code=404)
        comments = await get_post_comments(post_id, page["access_token"])
    except Exception as exc:
        return error_response(f"Failed to fetch comments: {exc}", status_code=502)
    return success_response(comments, "Comments retrieved")
