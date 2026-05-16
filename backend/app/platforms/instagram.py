"""
Instagram Graph API — OAuth2 (via Facebook) + content publishing + DMs.
Instagram Business accounts are linked to Facebook Pages; we reuse the
Facebook OAuth dialog with IG-specific scopes.

Scopes: instagram_basic, instagram_content_publish, instagram_manage_messages,
        pages_show_list
Publishing is a two-step process: create media container → publish.
"""
from datetime import datetime, timezone, timedelta
from urllib.parse import urlencode

import httpx

from app.config import settings
from app.utils.oauth import generate_state, store_state, consume_state

_GRAPH_VERSION = "v21.0"
_AUTH_URL = f"https://www.facebook.com/{_GRAPH_VERSION}/dialog/oauth"
_TOKEN_URL = f"https://graph.facebook.com/{_GRAPH_VERSION}/oauth/access_token"
_SCOPES = "instagram_basic,pages_show_list,instagram_content_publish,instagram_manage_messages"
_LONG_LIVED_EXPIRE_DAYS = 60


def get_auth_url(connector_id: str, user_id: str) -> str:
    state = generate_state()
    store_state(state, connector_id=connector_id, user_id=user_id, platform="instagram")
    params = {
        "client_id": settings.facebook_app_id,
        "redirect_uri": settings.instagram_redirect_uri,
        "scope": _SCOPES,
        "state": state,
        "response_type": "code",
    }
    return f"{_AUTH_URL}?{urlencode(params)}"


async def exchange_code(code: str, state: str) -> dict:
    state_data = consume_state(state)
    if not state_data:
        raise ValueError("Invalid or expired OAuth state")

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            _TOKEN_URL,
            params={
                "client_id": settings.facebook_app_id,
                "client_secret": settings.facebook_app_secret,
                "redirect_uri": settings.instagram_redirect_uri,
                "code": code,
            },
        )
        resp.raise_for_status()
        short_token = resp.json()["access_token"]

        resp2 = await client.get(
            _TOKEN_URL,
            params={
                "grant_type": "fb_exchange_token",
                "client_id": settings.facebook_app_id,
                "client_secret": settings.facebook_app_secret,
                "fb_exchange_token": short_token,
            },
        )
        resp2.raise_for_status()
        long_token = resp2.json()["access_token"]

    expires_at = datetime.now(timezone.utc) + timedelta(days=_LONG_LIVED_EXPIRE_DAYS)
    return {
        "connector_id": state_data["connector_id"],
        "user_id": state_data["user_id"],
        "access_token": long_token,
        "refresh_token": long_token,
        "expires_at": expires_at,
    }


async def get_instagram_accounts(access_token: str) -> list[dict]:
    """
    Return Instagram Business accounts linked to the user's FB pages.
    Each entry includes the page token needed for publishing/DMs.
    """
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://graph.facebook.com/{_GRAPH_VERSION}/me/accounts",
            params={
                "access_token": access_token,
                "fields": "id,name,access_token,instagram_business_account{id,name,username,profile_picture_url}",
            },
        )
        resp.raise_for_status()
        pages = resp.json().get("data", [])

    accounts = []
    for page in pages:
        ig = page.get("instagram_business_account")
        if ig:
            accounts.append({
                "page_id": page["id"],
                "page_name": page["name"],
                "page_token": page["access_token"],
                "ig_id": ig["id"],
                "ig_name": ig.get("name", ""),
                "ig_username": ig.get("username", ""),
                "ig_picture": ig.get("profile_picture_url", ""),
            })
    return accounts


async def publish_post(
    ig_id: str,
    page_token: str,
    caption: str,
    image_url: str | None = None,
    video_url: str | None = None,
) -> dict:
    """
    Publish to Instagram. image_url or video_url must be a publicly accessible URL.
    Returns {id: media_id}.
    """
    if not image_url and not video_url:
        raise ValueError("image_url or video_url is required for Instagram posts")

    async with httpx.AsyncClient(timeout=30.0) as client:
        params: dict = {"access_token": page_token, "caption": caption}
        if video_url:
            params["media_type"] = "REELS"
            params["video_url"] = video_url
        else:
            params["image_url"] = image_url

        resp = await client.post(
            f"https://graph.facebook.com/{_GRAPH_VERSION}/{ig_id}/media",
            params=params,
        )
        resp.raise_for_status()
        creation_id = resp.json()["id"]

        resp2 = await client.post(
            f"https://graph.facebook.com/{_GRAPH_VERSION}/{ig_id}/media_publish",
            params={"access_token": page_token, "creation_id": creation_id},
        )
        resp2.raise_for_status()
        return resp2.json()


async def send_dm(
    ig_id: str,
    page_token: str,
    recipient_id: str,
    message: str,
) -> dict:
    """
    Send an Instagram DM. Recipient must have messaged your account first (Meta policy).
    """
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"https://graph.facebook.com/{_GRAPH_VERSION}/{ig_id}/messages",
            params={"access_token": page_token},
            json={
                "recipient": {"id": recipient_id},
                "message": {"text": message},
            },
        )
        resp.raise_for_status()
        return resp.json()


async def get_conversations(ig_id: str, page_token: str) -> list[dict]:
    """
    List Instagram Direct conversations for a Business account.
    Uses platform=instagram to distinguish from Messenger threads.
    """
    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.get(
            f"https://graph.facebook.com/{_GRAPH_VERSION}/{ig_id}/conversations",
            params={
                "platform": "instagram",
                "fields": "id,participants,snippet,updated_time,unread_count",
                "access_token": page_token,
            },
        )
        resp.raise_for_status()
        return resp.json().get("data", [])


async def get_conversation_messages(conversation_id: str, page_token: str) -> list[dict]:
    """
    Get messages inside an Instagram Direct conversation, oldest-first.
    """
    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.get(
            f"https://graph.facebook.com/{_GRAPH_VERSION}/{conversation_id}/messages",
            params={
                "fields": "id,from,message,created_time",
                "access_token": page_token,
            },
        )
        resp.raise_for_status()
        # API returns newest-first — reverse so oldest appears at the top
        return list(reversed(resp.json().get("data", [])))
