"""
Real-time chat — WebSocket + REST.

WebSocket: GET /api/v1/chat/ws?token=<access_token>

Client → server frames:
  {"type": "message", "to_user_id": "...", "content": "..."}
  {"type": "read",    "from_user_id": "..."}

Server → client frames:
  {"type": "message",      ...ChatMessage}
  {"type": "status",       "user_id": "...", "online": true|false}
  {"type": "online_users", "user_ids": ["..."]}
"""

import json
from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from bson import ObjectId
from bson.errors import InvalidId
from jose import JWTError

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.chat import message_to_dict
from app.services.chat_service import (
    get_messages as db_get_messages,
    save_message as db_save_message,
    mark_read as db_mark_read,
    unread_counts as db_unread_counts,
)
from app.utils.jwt import decode_access_token

router = APIRouter(prefix="/api/v1/chat", tags=["chat"])


# ── Super Admin guard ─────────────────────────────────────────────────────────

def _is_super_admin(user: dict) -> bool:
    """True when the caller has the Super Admin system role."""
    role = user.get("_role") or {}
    return bool(role.get("is_system_role")) and role.get("role_name") == "Super Admin"


def _require_super_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if not _is_super_admin(current_user):
        raise HTTPException(status_code=403, detail="Super Admin access required")
    return current_user


# ── WebSocket connection manager ──────────────────────────────────────────────

class ConnectionManager:
    """Tracks live WebSocket connections keyed by user_id string."""

    def __init__(self) -> None:
        self._conns: dict[str, WebSocket] = {}

    async def connect(self, user_id: str, ws: WebSocket) -> None:
        await ws.accept()
        self._conns[user_id] = ws
        await self._broadcast(
            {"type": "status", "user_id": user_id, "online": True},
            exclude=user_id,
        )

    def disconnect(self, user_id: str) -> None:
        self._conns.pop(user_id, None)

    def is_online(self, user_id: str) -> bool:
        return user_id in self._conns

    def online_ids(self) -> list[str]:
        return list(self._conns.keys())

    async def send(self, user_id: str, payload: dict) -> None:
        ws = self._conns.get(user_id)
        if ws is None:
            return
        try:
            await ws.send_text(json.dumps(payload, default=str))
        except Exception:
            self.disconnect(user_id)

    async def _broadcast(self, payload: dict, exclude: str | None = None) -> None:
        text = json.dumps(payload, default=str)
        for uid, ws in list(self._conns.items()):
            if uid == exclude:
                continue
            try:
                await ws.send_text(text)
            except Exception:
                self.disconnect(uid)


manager = ConnectionManager()


# ── WebSocket endpoint ────────────────────────────────────────────────────────

@router.websocket("/ws")
async def chat_ws(ws: WebSocket, token: str = Query(...)) -> None:
    """Authenticate via ?token=<jwt> (browsers cannot set WS headers)."""
    try:
        payload = decode_access_token(token)
        user_id: str = payload["sub"]
    except (JWTError, KeyError):
        await ws.close(code=4001)
        return

    await manager.connect(user_id, ws)
    await manager.send(user_id, {
        "type": "online_users",
        "user_ids": manager.online_ids(),
    })

    try:
        while True:
            raw = await ws.receive_text()
            try:
                data: dict = json.loads(raw)
            except json.JSONDecodeError:
                continue

            if data.get("type") == "message":
                to_id = str(data.get("to_user_id", "")).strip()
                content = str(data.get("content", "")).strip()
                if not to_id or not content:
                    continue
                doc = await db_save_message(user_id, to_id, content)
                envelope = {"type": "message", **message_to_dict(doc)}
                await manager.send(user_id, envelope)
                await manager.send(to_id, envelope)

            elif data.get("type") == "read":
                from_id = str(data.get("from_user_id", "")).strip()
                if from_id:
                    await db_mark_read(from_id, user_id)

    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(user_id)
        await manager._broadcast({
            "type": "status", "user_id": user_id, "online": False
        })


# ── REST endpoints ────────────────────────────────────────────────────────────

@router.get("/users")
async def list_chat_users(current_user: dict = Depends(get_current_user)):
    """Return all active users except the caller, with live online status."""
    db = get_db()
    # Exclude self by ObjectId (already an ObjectId in the middleware-returned doc)
    cursor = db["users"].find(
        {"_id": {"$ne": current_user["_id"]}},
        {"hashed_password": 0},
    )
    docs = await cursor.to_list(500)

    result = []
    for d in docs:
        # Include user if is_active is True (or missing — legacy users default to active)
        # Also include if status is "active" or missing (belt-and-suspenders)
        is_active = d.get("is_active", True)
        status = d.get("status", "active")
        if not is_active or status == "inactive":
            continue
        result.append({
            "id": str(d["_id"]),
            "name": d.get("name", ""),
            "email": d.get("email", ""),
            "designation": d.get("designation", ""),
            "status": status,
            "online": manager.is_online(str(d["_id"])),
        })
    return result


@router.get("/messages/{other_id}")
async def get_messages(
    other_id: str,
    limit: int = Query(50, le=100),
    before_id: str | None = Query(None),
    current_user: dict = Depends(get_current_user),
):
    docs = await db_get_messages(
        str(current_user["_id"]), other_id, limit, before_id
    )
    return [message_to_dict(d) for d in docs]


@router.put("/messages/{other_id}/read")
async def mark_read_endpoint(
    other_id: str,
    current_user: dict = Depends(get_current_user),
):
    await db_mark_read(other_id, str(current_user["_id"]))
    return {"ok": True}


@router.get("/unread")
async def get_unread_counts(current_user: dict = Depends(get_current_user)):
    return await db_unread_counts(str(current_user["_id"]))


# ── Super Admin monitor endpoints ─────────────────────────────────────────────

@router.get("/admin/conversations")
async def admin_list_conversations(
    _: dict = Depends(_require_super_admin),
):
    """
    Return all unique conversation pairs with last-message preview.
    Super Admin only.
    """
    db = get_db()

    # Group messages by the canonical (sorted) pair key so each chat appears once
    pipeline = [
        {"$sort": {"created_at": -1}},
        {
            "$addFields": {
                "pair_key": {
                    "$cond": [
                        {"$lt": ["$from_user_id", "$to_user_id"]},
                        {"$concat": ["$from_user_id", "___", "$to_user_id"]},
                        {"$concat": ["$to_user_id", "___", "$from_user_id"]},
                    ]
                }
            }
        },
        {
            "$group": {
                "_id": "$pair_key",
                "last_msg": {"$first": "$$ROOT"},
                "msg_count": {"$sum": 1},
            }
        },
        {"$sort": {"last_msg.created_at": -1}},
        {"$limit": 300},
    ]
    pairs = await db["messages"].aggregate(pipeline).to_list(300)

    # Collect all distinct user IDs so we can batch-fetch names
    uid_strings: set[str] = set()
    for p in pairs:
        parts = p["_id"].split("___")
        if len(parts) == 2:
            uid_strings.update(parts)

    valid_oids = []
    for s in uid_strings:
        try:
            valid_oids.append(ObjectId(s))
        except (InvalidId, Exception):
            pass

    user_docs = await db["users"].find(
        {"_id": {"$in": valid_oids}},
        {"name": 1, "email": 1},
    ).to_list(500)
    users_map = {str(d["_id"]): d.get("name") or d.get("email", "Unknown") for d in user_docs}

    result = []
    for p in pairs:
        parts = p["_id"].split("___")
        if len(parts) != 2:
            continue
        id_a, id_b = parts
        last = p["last_msg"]
        created = last.get("created_at")
        result.append({
            "user_a_id":   id_a,
            "user_a_name": users_map.get(id_a, "Unknown"),
            "user_b_id":   id_b,
            "user_b_name": users_map.get(id_b, "Unknown"),
            "last_message":  last.get("content", ""),
            "last_sender_id": last.get("from_user_id", ""),
            "last_at":       created.isoformat() if created else None,
            "msg_count":     p["msg_count"],
        })
    return result


@router.get("/admin/messages/{user_a_id}/{user_b_id}")
async def admin_get_messages(
    user_a_id: str,
    user_b_id: str,
    limit: int = Query(100, le=200),
    _: dict = Depends(_require_super_admin),
):
    """
    Retrieve the full message thread between any two users.
    Super Admin only.  Polled every few seconds for live monitoring.
    """
    docs = await db_get_messages(user_a_id, user_b_id, limit)
    return [message_to_dict(d) for d in docs]
