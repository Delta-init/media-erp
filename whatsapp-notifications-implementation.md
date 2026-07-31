# How to Implement WhatsApp Notifications in a Project

A step-by-step guide to adding outbound WhatsApp notifications to a backend
project, using Meta's WhatsApp Cloud API directly (no third-party provider
like Twilio/WATI/Gupshup needed). Follow the steps in order — each one
builds on the last, and you can smoke-test after Step 5 before wiring up
any real triggers.

**What you end up with:** a small service module that sends WhatsApp
template/text messages, a test endpoint to verify credentials, a phone
number field on your user/recipient model, and a pattern for firing
notifications from your existing domain events (e.g. "task assigned",
"order shipped", "payment received") without ever letting a WhatsApp
failure break the underlying operation.

**What this guide does *not* cover** (add these separately if you need
them — see Step 9): inbound message webhooks, delivery-status tracking,
a message-log database table, retries/queues, rate limiting, or
per-user opt-in gating. This is a fire-and-forget, best-effort side
channel, not a full messaging platform.

Code below is Python/FastAPI/MongoDB, matching a real working
implementation — adapt the syntax to your stack, but keep the same shape
(one service module, one dispatcher pattern, try/except around every send).

---

## Step 1 — Set up WhatsApp Cloud API access in Meta Business Manager

Before writing any code:

1. Create a Meta (Facebook) Business App and add the **WhatsApp** product.
2. In WhatsApp Manager, note down your:
   - **Phone Number ID**
   - **Business Account ID (WABA ID)**
3. Generate a **permanent access token** (a system-user token — not the
   24-hour test token you get by default) with `whatsapp_business_messaging`
   permission.
4. Create and submit for approval a **message template** for each
   notification type you plan to send (e.g. `task_assigned`,
   `order_shipped`, `payment_received`). Approval can take minutes to a day,
   so do this first. Each template needs:
   - A unique **name** (lowercase + underscores)
   - A **language** code (e.g. `en`)
   - A **body** with numbered placeholders — `{{1}}`, `{{2}}`, ...

   Example body for a `task_assigned` template:
   > Hi {{1}}, you've been assigned a new task: *{{2}}*. Deadline: {{3}}.

   The number and order of placeholders must exactly match what your code
   sends later, or the API call will be rejected — get templates approved
   *before* moving on.

---

## Step 2 — Add environment variables

```env
WHATSAPP_PHONE_NUMBER_ID=123456789012345
WHATSAPP_TOKEN=EAAxxxxxxxxxxxxxxxxxxxxxxxxx      # permanent/system-user token
WHATSAPP_BUSINESS_ACCOUNT_ID=987654321098765     # kept for reference; not used by the send calls below
WHATSAPP_API_VERSION=v21.0                        # Graph API version segment
```

Load these through whatever config system your project already uses
(pydantic-settings, dotenv, etc.). `WHATSAPP_BUSINESS_ACCOUNT_ID` isn't
referenced by anything in this guide — keep it only if you'll later add
template-management API calls.

---

## Step 3 — Build the core sending service

Create one module that owns all outbound WhatsApp calls. It needs two
low-level senders (`send_template`, `send_text`) plus a phone-number
normalizer. This is the fully portable piece — it depends only on an HTTP
client and your four config values.

```python
"""WhatsApp Cloud API notification service."""
import logging
import httpx
from app.config import settings   # swap for your project's settings module

logger = logging.getLogger(__name__)
_BASE = "https://graph.facebook.com"


def _normalize_phone(phone: str) -> str:
    cleaned = phone.replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
    if not cleaned.startswith("+"):
        cleaned = "+" + cleaned
    return cleaned


async def send_template(
    to: str,
    template_name: str,
    components: list[dict] | None = None,
    language: str = "en",
) -> bool:
    """Send a WhatsApp template message. Returns True on success."""
    phone_id = settings.whatsapp_phone_number_id
    token = settings.whatsapp_token
    version = settings.whatsapp_api_version

    if not phone_id or not token:
        print("[WA] credentials not configured — skipping", flush=True)
        return False
    print(f"[WA] sending template={template_name} to={to}", flush=True)

    payload: dict = {
        "messaging_product": "whatsapp",
        "to": _normalize_phone(to),
        "type": "template",
        "template": {"name": template_name, "language": {"code": language}},
    }
    if components:
        payload["template"]["components"] = components

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(
                f"{_BASE}/{version}/{phone_id}/messages",
                json=payload,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
            )
        try:
            body = r.json()
        except Exception:
            body = r.text
        if r.status_code == 200:
            # Meta sometimes returns HTTP 200 but embeds an error in the body
            if isinstance(body, dict) and body.get("error"):
                err = body["error"]
                print(f"[WA] META ERROR on {template_name}: code={err.get('code')} msg={err.get('message')}", flush=True)
                return False
            print(f"[WA] OK sent: {template_name} -> {to} | response={body}", flush=True)
            return True
        print(f"[WA] HTTP {r.status_code} on {template_name}: {body}", flush=True)
        return False
    except Exception as exc:
        print(f"[WA] EXCEPTION sending {template_name}: {exc}", flush=True)
        return False


async def send_text(to: str, text: str) -> bool:
    """Free-form text message — only works within 24h of the user initiating contact."""
    phone_id = settings.whatsapp_phone_number_id
    token = settings.whatsapp_token
    version = settings.whatsapp_api_version

    if not phone_id or not token:
        logger.warning("WhatsApp credentials not configured — skipping")
        return False

    payload = {
        "messaging_product": "whatsapp",
        "to": _normalize_phone(to),
        "type": "text",
        "text": {"body": text},
    }
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(
                f"{_BASE}/{version}/{phone_id}/messages",
                json=payload,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
            )
        if r.status_code == 200:
            logger.info("WhatsApp text sent → %s", to)
            return True
        logger.error("WhatsApp text error %s: %s", r.status_code, r.text)
        return False
    except Exception as exc:
        logger.error("WhatsApp text send failed: %s", exc)
        return False
```

Notes on why it's written this way:
- **Template vs. text**: `send_template` works any time (required for
  first contact / outside a 24h window); `send_text` only works within 24h
  of the recipient messaging your business number first. Use `send_text`
  just for manual testing (Step 5) and rely on `send_template` for real
  notifications.
- **The 200-with-error-body check** matters — Meta sometimes returns HTTP
  200 with an `error` object inside the JSON. Skipping that check makes
  failed sends look like they succeeded.
- Every failure path returns `False` and logs — nothing raises out of this
  module. That's intentional; see Step 8.

---

## Step 4 — Add one notification helper per message type

Wrap `send_template` with a small helper per template, so calling code
never has to hand-build the `components` parameter array. The parameter
**order must match the template's `{{1}}`, `{{2}}`, ... placeholders**
exactly.

```python
# ── Notification helpers ──────────────────────────────────────────────────

async def notify_task_assigned(phone: str, user_name: str, task_title: str, deadline: str) -> bool:
    return await send_template(
        phone, "task_assigned",
        [{"type": "body", "parameters": [
            {"type": "text", "text": user_name},
            {"type": "text", "text": task_title},
            {"type": "text", "text": deadline or "Not set"},
        ]}],
    )


async def notify_task_approved(phone: str, user_name: str, task_title: str, approver: str) -> bool:
    return await send_template(
        phone, "task_approved",
        [{"type": "body", "parameters": [
            {"type": "text", "text": user_name},
            {"type": "text", "text": task_title},
            {"type": "text", "text": approver},
        ]}],
    )


async def notify_task_reedit(phone: str, user_name: str, task_title: str, reviewer: str, note: str) -> bool:
    return await send_template(
        phone, "task_reedit",
        [{"type": "body", "parameters": [
            {"type": "text", "text": user_name},
            {"type": "text", "text": task_title},
            {"type": "text", "text": reviewer},
            {"type": "text", "text": note or "Please review and resubmit."},
        ]}],
    )
```

Add these to the same module as Step 3. Write one helper per template you
created in Step 1 — the examples above are task-workflow notifications, but
the shape is identical for anything else (`notify_order_shipped`,
`notify_payment_received`, etc.): one `{"type": "text", "text": ...}` entry
per placeholder, in order.

---

## Step 5 — Add a test endpoint and verify credentials

Before wiring anything to real events, confirm the whole pipeline (token,
phone number ID, network access) actually works.

```python
"""WhatsApp router — test endpoint + recipient phone management."""
from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel

from app.database import get_db
from app.middleware.auth import get_current_user
from app.services.whatsapp_service import send_text
from app.utils.response import error_response, success_response

router = APIRouter(prefix="/api/v1/whatsapp", tags=["whatsapp"])


class PhoneUpdate(BaseModel):
    whatsapp_phone: str


@router.post("/test")
async def test_whatsapp(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Send a test WhatsApp message to confirm the integration is working."""
    ok = await send_text(
        "+91XXXXXXXXXX",   # replace with your own phone number
        "✅ WhatsApp notifications are working!",
    )
    if ok:
        return success_response(message="Test message sent")
    return error_response("Failed to send — check WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID in .env", 500)


@router.put("/phone")
async def update_whatsapp_phone(
    body: PhoneUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Save the current user's WhatsApp phone number for notifications."""
    from bson import ObjectId
    uid = current_user["_id"]
    await db["users"].update_one(
        {"_id": ObjectId(str(uid))},
        {"$set": {"whatsapp_phone": body.whatsapp_phone}},
    )
    return success_response(message="WhatsApp phone updated")
```

Register the router in your app entrypoint:

```python
from app.routers import whatsapp as whatsapp_router
app.include_router(whatsapp_router.router)
```

Call `POST /api/v1/whatsapp/test` and confirm the message actually arrives
on your phone. If it fails, the error will point at credentials (bad token,
wrong phone number ID) — fix that here before continuing, since every later
step assumes this works.

---

## Step 6 — Add a phone number field to your recipient model

You need somewhere to store each recipient's WhatsApp number. A single
string field on your existing user/customer model is enough — no dedicated
table required.

```python
# create/update schemas
class CreateUserRequest(BaseModel):
    ...
    whatsapp_phone: Optional[str] = ""

class UpdateUserRequest(BaseModel):
    ...
    whatsapp_phone: Optional[str] = None
```

Persist and serialize it like any other field: default to `""` on create,
patch only when explicitly provided on update, include it in whatever DTO
you return the record as.

**Add opt-in gating here if you need it.** This guide's pattern sends
unconditionally whenever the phone field is populated — there's no separate
"WhatsApp notifications enabled" toggle. If your project needs consent
(recommended for anything user-facing), add a boolean field alongside
`whatsapp_phone` now and check it in Step 8 before calling any `notify_*`
helper.

---

## Step 7 — Add a phone input to your existing edit form

The only UI surface required is a phone field in whatever form already
edits the recipient record:

```tsx
const [waPhone, setWaPhone] = useState("");
// populate on edit:
setWaPhone(user.whatsapp_phone ?? "");

// include in the create/update payload:
const payload = { name, email, ..., whatsapp_phone: waPhone };
```

```tsx
<Field label="WhatsApp Phone">
  <input type="tel" value={waPhone} onChange={e => setWaPhone(e.target.value)}
         placeholder="+91 98765 43210" />
  <p className="text-xs text-muted-foreground mt-1">
    Include country code. Used for WhatsApp notifications.
  </p>
</Field>
```

No dedicated WhatsApp settings page, template preview, or send-log viewer
is needed — this one field is the entire frontend footprint.

---

## Step 8 — Wire notification sends into your domain events

This is the step that actually makes notifications go out. Call your
`notify_*` helpers from wherever the relevant event already happens in your
code (task created, order shipped, payment received, etc.) — **after** the
primary database write succeeds, and **never** let a WhatsApp failure
propagate back to the caller.

```python
async def fire_notifications(db, record: dict, event: str, actor_id: str, actor_name: str) -> None:
    from app.services import whatsapp_service as wa

    recipient_id = record.get("assigned_to") or ""

    # 1. Look up the recipient's WhatsApp phone (skip silently if not set)
    recipient_phone = ""
    if recipient_id and ObjectId.is_valid(recipient_id):
        _u = await db["users"].find_one({"_id": ObjectId(recipient_id)}, {"whatsapp_phone": 1})
        if _u:
            recipient_phone = _u.get("whatsapp_phone") or ""

    # 2. Send your primary notification channel first (in-app, email, etc.)
    await push_notification(db, recipient_id, "task_assigned", "New task assigned to you", ..., meta)

    # 3. WhatsApp is a best-effort side channel — wrap every call individually
    #    so a WhatsApp outage or bad template never fails the calling request.
    if recipient_phone:
        try:
            await wa.notify_task_assigned(recipient_phone, recipient_name, task_title, due_date)
        except Exception as _wa_err:
            print(f"[WA] task_assigned fire failed: {_wa_err}", flush=True)
```

Two rules to keep, regardless of how you adapt this to your own events:

1. **Call it after the primary write succeeds**, so a WhatsApp problem
   never blocks or rolls back the actual business operation.
2. **One try/except per WhatsApp call**, logged and swallowed, never
   re-raised.

This dispatches inline from the request handler — no queue or scheduled
job. That's a deliberate simplification: a slow WhatsApp call adds latency
to the user's request (bounded by the 15s timeout in Step 3), and a message
can be lost if the process crashes mid-send. If you need stronger delivery
guarantees, push the `wa.notify_*` call onto a task queue (Celery, RQ, a
simple background-task runner) instead of awaiting it inline — the service
module from Step 3 doesn't change, only where it's invoked from.

---

## Step 9 — Decide what production-hardening you actually need

This guide gets you a working, best-effort notification channel. It
deliberately does **not** include:

- Inbound webhook / delivery-status callbacks (`sent`/`delivered`/`read`/`failed`)
- A message-log or send-history table
- Retry, backoff, or dead-letter handling — one attempt per event
- Rate limiting
- Per-recipient opt-in/consent gating (see the note in Step 6)
- Phone-number validation beyond prefixing `+` (no `phonenumbers` library,
  no length/country-code checks)
- A cron/scheduled job — everything here is triggered inline from request
  handlers, not a background worker

None of these are hard to add on top of the Step 3 service module — they're
just genuinely separate concerns (a webhook route for delivery status, a
`whatsapp_messages` collection for logging, a queue worker for retries).
Add only the ones your project actually needs; don't build them
speculatively.

---

## Checklist

1. [ ] Meta app created, phone number ID + WABA ID + permanent token obtained
2. [ ] Templates designed and **approved** for every notification type
3. [ ] `WHATSAPP_*` env vars added to config
4. [ ] `whatsapp_service.py` created with `send_template` / `send_text` / `_normalize_phone`
5. [ ] One `notify_*` helper added per approved template
6. [ ] Test router added, `POST /whatsapp/test` confirmed working end-to-end
7. [ ] `whatsapp_phone` field added to the recipient model + edit form
8. [ ] `notify_*` calls wired into domain event handlers, each in its own try/except, after the primary DB write
9. [ ] Reviewed Step 9 and decided which hardening pieces (if any) this project actually needs
