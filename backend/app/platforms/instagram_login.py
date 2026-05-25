"""
Instagram Login — OAuth2 direct Instagram login (no Facebook Page required).
Meta's replacement for the deprecated Basic Display API (shut down Dec 2024).

Scopes: instagram_business_basic, instagram_business_content_publish,
        instagram_business_manage_messages

Works with Business AND Creator accounts. No Facebook Page linking required.

Auth URL:    https://www.instagram.com/oauth/authorize
Token URL:   https://api.instagram.com/oauth/access_token  (short-lived, POST form)
Long-lived:  https://graph.instagram.com/access_token  (GET, ~60 days)
Refresh:     https://graph.instagram.com/refresh_access_token  (GET)
API base:    https://graph.instagram.com/v21.0/
"""
from datetime import datetime, timezone, timedelta
from urllib.parse import urlencode

import httpx

from app.config import settings
from app.utils.oauth import generate_state, store_state, consume_state

_GRAPH_VERSION = "v21.0"
_AUTH_URL = "https://www.instagram.com/oauth/authorize"
_SHORT_TOKEN_URL = "https://api.instagram.com/oauth/access_token"
_LONG_TOKEN_URL = "https://graph.instagram.com/access_token"
_REFRESH_URL = "https://graph.instagram.com/refresh_access_token"
_API_BASE = f"https://graph.instagram.com/{_GRAPH_VERSION}"
_SCOPES = "instagram_business_basic,instagram_business_content_publish,instagram_business_manage_messages,instagram_business_manage_comments"
_LONG_LIVED_EXPIRE_DAYS = 60


def _raise_meta_error(resp: "httpx.Response") -> None:
    """Extract the human-readable error from a Meta/Instagram API error response and raise it."""
    import httpx as _httpx
    try:
        body = resp.json()
        err  = body.get("error", {})
        msg  = err.get("error_user_msg") or err.get("message") or f"HTTP {resp.status_code}"
        code = err.get("code", "")
        sub  = err.get("error_subcode", "")
        label = f"(code {code}" + (f"/{sub}" if sub else "") + ")"
        raise ValueError(f"Instagram API error {label}: {msg}")
    except ValueError:
        raise
    except Exception:
        resp.raise_for_status()


def get_auth_url(connector_id: str, user_id: str) -> str:
    if not settings.instagram_app_id or not settings.instagram_app_secret:
        raise ValueError(
            "instagram_not_configured"
        )
    state = generate_state()
    store_state(state, connector_id=connector_id, user_id=user_id, platform="instagram_login")
    params = {
        "client_id": settings.instagram_app_id,
        "redirect_uri": settings.instagram_login_redirect_uri,
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
        # Step 1: Short-lived token (POST, form-encoded — NOT JSON)
        resp = await client.post(
            _SHORT_TOKEN_URL,
            data={
                "client_id": settings.instagram_app_id,
                "client_secret": settings.instagram_app_secret,
                "grant_type": "authorization_code",
                "redirect_uri": settings.instagram_login_redirect_uri,
                "code": code,
            },
        )
        if not resp.is_success:
            try:
                err = resp.json().get("error", {})
                msg = err.get("error_user_msg") or err.get("message") or f"HTTP {resp.status_code}"
                code_val = err.get("code", "")
                raise ValueError(f"Instagram auth failed (code {code_val}): {msg}")
            except ValueError:
                raise
            except Exception:
                raise ValueError(f"Instagram auth failed with HTTP {resp.status_code}. "
                                 "Ensure the account is a Business or Creator account.")
        short_data = resp.json()
        short_token = short_data["access_token"]

        # Step 2: Exchange short-lived → long-lived (GET)
        resp2 = await client.get(
            _LONG_TOKEN_URL,
            params={
                "grant_type": "ig_exchange_token",
                "client_secret": settings.instagram_app_secret,
                "access_token": short_token,
            },
        )
        if not resp2.is_success:
            try:
                err = resp2.json().get("error", {})
                msg = err.get("error_user_msg") or err.get("message") or f"HTTP {resp2.status_code}"
                code_val = err.get("code", "")
                raise ValueError(f"Instagram token exchange failed (code {code_val}): {msg}. "
                                 "Make sure the account is a Business or Creator account.")
            except ValueError:
                raise
            except Exception:
                raise ValueError(f"Instagram long-lived token exchange failed with HTTP {resp2.status_code}. "
                                 "Make sure the account is a Business or Creator account.")
        long_data = resp2.json()
        long_token = long_data["access_token"]
        expires_in = long_data.get("expires_in", _LONG_LIVED_EXPIRE_DAYS * 86400)

        # Step 3: Fetch IG user ID to store as platform_account_id
        resp3 = await client.get(
            f"{_API_BASE}/me",
            params={
                "access_token": long_token,
                "fields": "id,name,username",
            },
        )
        resp3.raise_for_status()
        user_info = resp3.json()

    expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
    return {
        "connector_id": state_data["connector_id"],
        "user_id": state_data["user_id"],
        "access_token": long_token,
        "refresh_token": long_token,
        "expires_at": expires_at,
        "ig_user_id": user_info["id"],
        "ig_username": user_info.get("username", ""),
    }


async def get_user_info(access_token: str) -> dict:
    """Return basic profile info for the connected Instagram account."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{_API_BASE}/me",
            params={
                "access_token": access_token,
                "fields": "id,name,username,profile_picture_url,followers_count,media_count",
            },
        )
        resp.raise_for_status()
        return resp.json()


async def publish_post(
    ig_user_id: str,
    access_token: str,
    caption: str,
    image_url: str | None = None,
    video_url: str | None = None,
) -> dict:
    """
    Publish to Instagram via Instagram Login.
    Two-step: create media container → publish.
    For videos/Reels: polls until container status is FINISHED before publishing.
    image_url or video_url must be a publicly accessible URL.
    Returns {id: media_id}.
    """
    import asyncio

    if not image_url and not video_url:
        raise ValueError("image_url or video_url is required for Instagram posts")

    # Instagram Graph API requires a publicly accessible HTTPS URL — reject data: URIs
    # which are base64-encoded blobs that Instagram's servers cannot fetch.
    for url, label in ((image_url, "image_url"), (video_url, "video_url")):
        if url and url.startswith("data:"):
            raise ValueError(
                f"The {label} is a base64 data URL which Instagram cannot access. "
                "Please upload the file first using the upload button and use the "
                "returned public HTTPS URL instead."
            )
        if url and not url.startswith(("http://", "https://")):
            raise ValueError(
                f"The {label} must be a publicly accessible http:// or https:// URL. "
                f"Received: {url[:80]}"
            )

    # Videos need longer timeout for processing; images are immediate
    timeout = 120.0 if video_url else 30.0
    async with httpx.AsyncClient(timeout=timeout) as client:
        params: dict = {"access_token": access_token, "caption": caption}
        if video_url:
            params["media_type"] = "REELS"
            params["video_url"] = video_url
        else:
            params["image_url"] = image_url

        # Step 1: Create media container
        resp = await client.post(
            f"{_API_BASE}/{ig_user_id}/media",
            params=params,
        )
        if not resp.is_success:
            try:
                err = resp.json().get("error", {})
                msg = err.get("error_user_msg") or err.get("message") or f"HTTP {resp.status_code}"
                code_val = err.get("code", "")
                raise ValueError(f"Instagram media creation failed (code {code_val}): {msg}")
            except ValueError:
                raise
            except Exception:
                raise ValueError(f"Instagram media creation failed with HTTP {resp.status_code}")
        creation_id = resp.json()["id"]

        # Step 2: For videos/Reels, poll until container is FINISHED
        # Instagram processes video asynchronously — publishing before FINISHED returns 400
        if video_url:
            max_wait_secs = 90
            poll_interval = 5
            elapsed = 0
            while elapsed < max_wait_secs:
                await asyncio.sleep(poll_interval)
                elapsed += poll_interval
                status_resp = await client.get(
                    f"{_API_BASE}/{creation_id}",
                    params={"access_token": access_token, "fields": "status_code"},
                )
                if status_resp.is_success:
                    status_code = status_resp.json().get("status_code", "")
                    if status_code == "FINISHED":
                        break
                    elif status_code in ("ERROR", "EXPIRED"):
                        raise ValueError(
                            f"Instagram video processing {status_code.lower()}. "
                            "Try a shorter video (under 90 seconds) or re-encode as MP4 (H.264 video, AAC audio)."
                        )
                    # IN_PROGRESS → keep waiting
            else:
                raise ValueError(
                    "Instagram video is still processing after 90 seconds. "
                    "Try a shorter video or ensure the URL is a direct publicly accessible MP4 link."
                )

        # Step 3: Publish the container
        resp2 = await client.post(
            f"{_API_BASE}/{ig_user_id}/media_publish",
            params={"access_token": access_token, "creation_id": creation_id},
        )
        if not resp2.is_success:
            try:
                err = resp2.json().get("error", {})
                msg = err.get("error_user_msg") or err.get("message") or f"HTTP {resp2.status_code}"
                code_val = err.get("code", "")
                raise ValueError(f"Instagram publish failed (code {code_val}): {msg}")
            except ValueError:
                raise
            except Exception:
                raise ValueError(f"Instagram publish failed with HTTP {resp2.status_code}")
        return resp2.json()


async def get_media(ig_user_id: str, access_token: str, limit: int = 20) -> list[dict]:
    """Fetch the user's Instagram posts/media."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{_API_BASE}/{ig_user_id}/media",
            params={
                "access_token": access_token,
                "fields": "id,caption,media_type,media_url,thumbnail_url,timestamp,like_count,comments_count,permalink",
                "limit": limit,
            },
        )
        if not resp.is_success:
            _raise_meta_error(resp)
        return resp.json().get("data", [])


async def get_media_comments(media_id: str, access_token: str) -> list[dict]:
    """
    Fetch comments on a specific Instagram post.
    Requires instagram_business_manage_comments scope.
    """
    async with httpx.AsyncClient() as client:
        # Primary approach: dedicated comments edge
        resp = await client.get(
            f"{_API_BASE}/{media_id}/comments",
            params={
                "access_token": access_token,
                "fields": "id,text,timestamp,username,like_count,replies{id,text,timestamp,username,like_count}",
                "limit": 100,
            },
        )
        if not resp.is_success:
            _raise_meta_error(resp)
        comments = resp.json().get("data", [])

        # Fallback: if the edge returned nothing, try fetching comments
        # embedded in the media object itself (works on some account types)
        if not comments:
            resp2 = await client.get(
                f"{_API_BASE}/{media_id}",
                params={
                    "access_token": access_token,
                    "fields": "comments{id,text,timestamp,username,like_count}",
                },
            )
            if resp2.is_success:
                comments = resp2.json().get("comments", {}).get("data", [])

        return comments


async def get_conversations(ig_user_id: str, access_token: str) -> list[dict]:
    """
    List Instagram Direct conversations for the connected account.

    IGSID vs IGBID mismatch: Instagram conversations return participant IDs
    in IGSID format, but /me returns the account's IGBID.  They are different
    numbers for the same user.  External enrichment calls (GET /{igsid}) also
    echo back the connected account's own data for ANY igsid — so they cannot
    distinguish self from other.

    Solution: request participants{id,name,username} directly in the
    conversations query.  Compare each participant's username against
    self_username (from /me).  This avoids separate per-user lookups entirely.
    """
    async with httpx.AsyncClient() as client:
        # ── 1. Get self identity from /me ──────────────────────────────────────
        self_ids: set[str] = {str(ig_user_id)}
        self_username: str = ""
        self_name: str = ""
        try:
            me_resp = await client.get(
                f"{_API_BASE}/me",
                params={"access_token": access_token, "fields": "id,username,name"},
            )
            if me_resp.is_success:
                me_data = me_resp.json()
                self_ids.add(str(me_data.get("id", "")))
                self_username = me_data.get("username", "")
                self_name = me_data.get("name", "")
        except Exception:
            pass

        # ── 2. Fetch conversations — explicitly request username in participants ─
        resp = await client.get(
            f"{_API_BASE}/{ig_user_id}/conversations",
            params={
                "access_token": access_token,
                "fields": "id,participants{id,name,username},snippet,updated_time,unread_count",
                "platform": "instagram",
            },
        )
        if not resp.is_success:
            _raise_meta_error(resp)
        conversations = resp.json().get("data", [])

        # ── 3. Mark is_self by username/ID comparison ──────────────────────────
        # Pass 1: detect self-IGSIDs from participant username field
        for conv in conversations:
            for p in conv.get("participants", {}).get("data", []):
                pid = str(p.get("id", ""))
                p_username = (p.get("username") or "").strip()
                p_name = (p.get("name") or "").strip()
                is_self = (
                    pid in self_ids
                    or (self_username and p_username == self_username)
                    or (self_name and p_name == self_name and not p_username)
                )
                if is_self:
                    self_ids.add(pid)   # record this IGSID for message alignment

        # Pass 2: stamp is_self flag + format display name for other participants
        for conv in conversations:
            for p in conv.get("participants", {}).get("data", []):
                pid = str(p.get("id", ""))
                is_self = pid in self_ids
                p["is_self"] = is_self

                # For "other" participants: prefer @username, fall back to name
                if not is_self:
                    p_username = (p.get("username") or "").strip()
                    p_name = (p.get("name") or "").strip()
                    if p_username and not p.get("name"):
                        p["name"] = f"@{p_username}"

        return conversations


async def get_conversation_messages(conversation_id: str, access_token: str) -> list[dict]:
    """Get messages inside an Instagram Direct conversation."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{_API_BASE}/{conversation_id}/messages",
            params={
                "access_token": access_token,
                "fields": "id,message,from,created_time",
            },
        )
        if not resp.is_success:
            _raise_meta_error(resp)
        # API returns newest first — reverse so oldest is at top
        return list(reversed(resp.json().get("data", [])))


async def send_dm(
    ig_user_id: str,
    access_token: str,
    recipient_id: str,
    message: str,
) -> dict:
    """
    Send an Instagram DM via Instagram Login.

    recipient_id must be the other user's IGSID (from conversations participants).
    Meta policy: the recipient must have messaged your account within the last
    24 hours. In Development mode your Meta app must list them as a test user.
    """
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{_API_BASE}/{ig_user_id}/messages",
            params={"access_token": access_token},
            json={
                "recipient": {"id": recipient_id},
                "message": {"text": message},
            },
        )
        if not resp.is_success:
            _raise_meta_error(resp)
        return resp.json()
