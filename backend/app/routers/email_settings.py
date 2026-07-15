from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.database import get_db
from app.middleware.auth import get_current_user
from app.utils.response import error_response, success_response

router = APIRouter(prefix="/api/v1/settings", tags=["email-settings"])


def _is_super_admin(user: dict) -> bool:
    role = user.get("_role") or {}
    return bool(role.get("is_system_role") and role.get("role_name") == "Super Admin")


@router.get("/email-smtp")
async def get_smtp_config(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    if not _is_super_admin(current_user):
        return error_response("Only Super Admin can access email settings", status_code=403)

    doc = await db["email_settings"].find_one({"_id": "smtp"})
    if doc:
        config = {
            "host":       doc.get("host", ""),
            "port":       doc.get("port", 587),
            "username":   doc.get("username", ""),
            "password":   "••••••••" if doc.get("password") else "",
            "from_email": doc.get("from_email", ""),
            "from_name":  doc.get("from_name", "mediaERP"),
            "use_tls":    doc.get("use_tls", True),
            "configured": bool(doc.get("host") and doc.get("username") and doc.get("password")),
        }
    else:
        config = {
            "host": "", "port": 587, "username": "", "password": "",
            "from_email": "", "from_name": "mediaERP", "use_tls": True, "configured": False,
        }
    return success_response(config, "Email settings retrieved")


@router.put("/email-smtp")
async def update_smtp_config(
    body: dict,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    if not _is_super_admin(current_user):
        return error_response("Only Super Admin can update email settings", status_code=403)

    allowed = {"host", "port", "username", "password", "from_email", "from_name", "use_tls"}
    update = {k: v for k, v in body.items() if k in allowed}

    if not update.get("host") or not update.get("username") or not update.get("from_email"):
        return error_response("host, username, and from_email are required", status_code=422)

    # If client sent back the masked placeholder, keep the existing password
    pw = update.get("password", "")
    if not pw or pw == "••••••••":
        update.pop("password", None)

    try:
        await db["email_settings"].update_one(
            {"_id": "smtp"},
            {"$set": update, "$setOnInsert": {"_id": "smtp"}},
            upsert=True,
        )
    except Exception as exc:
        return error_response(f"Failed to save settings: {exc}", status_code=500)
    return success_response(None, "Email settings saved")


@router.post("/email-smtp/test")
async def test_smtp_config(
    body: dict,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    if not _is_super_admin(current_user):
        return error_response("Only Super Admin can test email settings", status_code=403)

    to_email = body.get("to") or current_user.get("email")
    if not to_email:
        return error_response("Recipient email required", status_code=422)

    from app.utils.email import send_email_db
    try:
        await send_email_db(db=db, to=to_email, subject="mediaERP — SMTP Test", html_body=_test_html(), category="smtp_test")
    except Exception as exc:
        return error_response(f"SMTP test failed: {exc}", status_code=500)

    return success_response(None, f"Test email sent to {to_email}")


def _test_html() -> str:
    return """<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0"
             style="background:#fff;border-radius:12px;overflow:hidden;
                    box-shadow:0 2px 8px rgba(0,0,0,.08);">
        <tr><td style="background:#18181b;padding:28px 36px;">
          <span style="font-size:20px;font-weight:700;color:#fff;">mediaERP</span>
        </td></tr>
        <tr><td style="padding:36px;">
          <h2 style="margin:0 0 12px;color:#18181b;">SMTP test successful</h2>
          <p style="color:#555;font-size:15px;line-height:1.6;">
            Your email settings are configured correctly.<br>
            Notifications will be delivered to this address.
          </p>
        </td></tr>
        <tr><td style="background:#f9f9f9;padding:16px 36px;border-top:1px solid #eee;">
          <p style="margin:0;font-size:12px;color:#aaa;">
            &copy; 2025 mediaERP &mdash; Carlton Trading Academy
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""
