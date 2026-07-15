"""
Async email utility using stdlib smtplib (no extra dependency).
Runs the blocking SMTP call in a thread-pool executor so it
doesn't block the FastAPI event loop.

Config priority: MongoDB `email_settings` collection → .env fallback.

Port behaviour
--------------
465  → SMTP_SSL  (SSL from the start — no STARTTLS)
587  → SMTP + STARTTLS  (upgrade mid-session — standard Gmail App Password flow)
other→ same as 587 when use_tls=True, plain SMTP otherwise
"""
import asyncio
import logging
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formatdate, make_msgid
from typing import Optional

from app.config import settings

logger = logging.getLogger(__name__)

_SMTP_TIMEOUT = 20  # seconds


def _load_smtp_config_sync() -> Optional[dict]:
    """
    Read SMTP config from the `email_settings` collection using the SYNCHRONOUS
    PyMongo client, so it works from `_send_sync` (thread pool) regardless of
    which caller/event-loop triggered the send. Returns None if not configured
    (callers then fall back to `.env`). This is what makes `send_email()` use the
    DB config too — not just `send_email_db()`.
    """
    try:
        from app.database import get_sync_db
        doc = get_sync_db()["email_settings"].find_one({"_id": "smtp"})
        if doc and doc.get("host") and doc.get("username") and doc.get("password"):
            return doc
    except Exception:
        pass
    return None


def _log_email(to: str, subject: str, status: str, error: Optional[str], from_email: str, category: str) -> None:
    """
    Record an email send attempt in the `email_logs` collection.

    Uses the SYNCHRONOUS PyMongo client because this runs inside `_send_sync`
    (a thread-pool executor) which is also reached from the scheduler daemon
    threads — the async Motor client is bound to the main event loop and can't
    be used here. Logging failures are swallowed so they can never break a send.
    """
    try:
        from datetime import datetime, timezone
        from app.database import get_sync_db

        get_sync_db()["email_logs"].insert_one({
            "to": to,
            "subject": subject,
            "status": status,          # "sent" | "failed"
            "error": error,
            "from_email": from_email,
            "category": category,      # password_reset | report | rule_alert | client_invite | smtp_test | general
            "created_at": datetime.now(timezone.utc),
        })
    except Exception:
        pass  # never let logging break email delivery


async def get_smtp_config(db) -> Optional[dict]:
    """Fetch SMTP config from the `email_settings` collection; None if not configured."""
    try:
        doc = await db["email_settings"].find_one({"_id": "smtp"})
        if doc and doc.get("host") and doc.get("username") and doc.get("password"):
            return doc
    except Exception:
        pass
    return None


def _send_sync(to: str, subject: str, html_body: str, cfg: Optional[dict] = None, category: str = "general") -> None:
    """Blocking SMTP send — runs in a thread-pool executor.

    Config priority: explicit `cfg` (from `send_email_db`) → DB `email_settings`
    (read here via sync client) → `.env`. So every caller uses the DB SMTP.
    """
    if cfg is None:
        cfg = _load_smtp_config_sync()
    host       = (cfg or {}).get("host")       or settings.mail_server
    port       = int((cfg or {}).get("port")   or settings.mail_port or 587)
    username   = (cfg or {}).get("username")   or settings.mail_username
    password   = (cfg or {}).get("password")   or settings.mail_password
    from_email = (cfg or {}).get("from_email") or settings.mail_from
    from_name  = (cfg or {}).get("from_name")  or settings.mail_from_name
    use_tls    = (cfg or {}).get("use_tls", True) if cfg else True

    if not username or not password or not from_email:
        _log_email(to, subject, "failed", "Email not configured (no SMTP credentials)", from_email or "", category)
        raise RuntimeError(
            "Email is not configured — set credentials via Super Admin › Settings › Email SMTP"
        )

    domain = from_email.split("@")[1] if "@" in from_email else "mediaerp.com"

    msg = MIMEMultipart("alternative")
    msg["Subject"]    = subject
    msg["From"]       = f"{from_name} <{from_email}>"
    msg["To"]         = to
    msg["Date"]       = formatdate(localtime=True)
    msg["Message-ID"] = make_msgid(domain=domain)
    msg.attach(MIMEText(html_body, "html"))

    ctx = ssl.create_default_context()

    try:
        if port == 465:
            # Port 465 — SSL from the start (no STARTTLS)
            with smtplib.SMTP_SSL(host, port, timeout=_SMTP_TIMEOUT, context=ctx) as server:
                server.ehlo()
                server.login(username, password)
                server.sendmail(from_email, [to], msg.as_string())
        else:
            # Port 587 always requires STARTTLS (Gmail/standard); other ports
            # respect the use_tls flag from the DB config.
            with smtplib.SMTP(host, port, timeout=_SMTP_TIMEOUT) as server:
                server.ehlo()
                if use_tls or port == 587:
                    server.starttls(context=ctx)
                    server.ehlo()
                server.login(username, password)
                server.sendmail(from_email, [to], msg.as_string())
    except smtplib.SMTPAuthenticationError as exc:
        logger.error("SMTP auth failed for %s: %s", username, exc)
        _log_email(to, subject, "failed", f"Authentication failed ({exc.smtp_code})", from_email, category)
        # Surface a friendly message for the most common Gmail mistake
        raise RuntimeError(
            f"Authentication failed ({exc.smtp_code}). "
            "For Gmail, you must use a 16-character App Password "
            "(Google Account › Security › 2-Step Verification › App passwords), "
            "not your regular Gmail password."
        ) from exc
    except Exception as exc:
        logger.error("SMTP send failed → %s | %s", to, exc, exc_info=True)
        _log_email(to, subject, "failed", str(exc), from_email, category)
        raise

    _log_email(to, subject, "sent", None, from_email, category)
    logger.info("Email sent → %s | Subject: %s", to, subject)


async def send_email(to: str, subject: str, html_body: str, category: str = "general") -> None:
    """Non-blocking wrapper using .env SMTP config."""
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, _send_sync, to, subject, html_body, None, category)


async def send_email_db(db, to: str, subject: str, html_body: str, category: str = "general") -> None:
    """Like send_email but reads SMTP config from DB first; falls back to .env."""
    cfg = await get_smtp_config(db)
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, _send_sync, to, subject, html_body, cfg, category)


async def send_otp_email(to: str, otp: str) -> None:
    """Send a styled OTP email for password reset."""
    html = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:12px;overflow:hidden;
                      box-shadow:0 2px 8px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:#18181b;padding:28px 36px;">
              <span style="font-size:20px;font-weight:700;color:#ffffff;
                           letter-spacing:-0.5px;">mediaERP</span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 36px 28px;">
              <h2 style="margin:0 0 12px;font-size:22px;color:#18181b;">
                Reset your password
              </h2>
              <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.6;">
                Use the one-time code below to reset your password.
                This code expires in <strong>10&nbsp;minutes</strong>.
              </p>

              <!-- OTP box -->
              <div style="background:#f4f4f5;border-radius:10px;padding:24px;
                          text-align:center;margin-bottom:24px;">
                <span style="font-size:40px;font-weight:800;letter-spacing:14px;
                             color:#18181b;font-family:'Courier New',monospace;">
                  {otp}
                </span>
              </div>

              <p style="margin:0;font-size:13px;color:#888;line-height:1.6;">
                If you didn&rsquo;t request a password reset, you can safely ignore
                this email. Your password will not be changed.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9f9f9;padding:16px 36px;border-top:1px solid #eee;">
              <p style="margin:0;font-size:12px;color:#aaa;">
                &copy; 2025 mediaERP &mdash; Carlton Trading Academy
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""
    await send_email(to, "Your mediaERP password reset code", html, category="password_reset")
