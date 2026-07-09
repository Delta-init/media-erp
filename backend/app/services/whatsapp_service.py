"""WhatsApp Cloud API notification service."""
import logging
import httpx
from app.config import settings

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
            # Meta sometimes returns 200 but with an error block inside the JSON
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
    """Free-form text message — only works within 24 h of user initiating contact."""
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


# ── Notification helpers ──────────────────────────────────────────────────────

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


async def notify_project_completed(phone: str, project_name: str, team_name: str, date: str) -> bool:
    return await send_template(
        phone, "project_completed",
        [{"type": "body", "parameters": [
            {"type": "text", "text": project_name},
            {"type": "text", "text": team_name},
            {"type": "text", "text": date},
        ]}],
    )


async def notify_deadline_reminder(phone: str, user_name: str, task_title: str, time_left: str) -> bool:
    return await send_template(
        phone, "deadline_reminder",
        [{"type": "body", "parameters": [
            {"type": "text", "text": user_name},
            {"type": "text", "text": task_title},
            {"type": "text", "text": time_left},
        ]}],
    )
