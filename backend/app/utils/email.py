"""
Async email utility using stdlib smtplib (no extra dependency).
Runs the blocking SMTP call in a thread-pool executor so it
doesn't block the FastAPI event loop.
"""
import asyncio
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.config import settings

logger = logging.getLogger(__name__)

_SMTP_TIMEOUT = 15  # seconds — fail fast instead of hanging forever


def _send_sync(to: str, subject: str, html_body: str) -> None:
    """Blocking SMTP send — runs in a thread-pool executor."""
    if not settings.mail_username or not settings.mail_password or not settings.mail_from:
        raise RuntimeError(
            "Email is not configured. "
            "Set MAIL_USERNAME, MAIL_PASSWORD and MAIL_FROM in .env"
        )

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{settings.mail_from_name} <{settings.mail_from}>"
    msg["To"] = to
    msg.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP(settings.mail_server, settings.mail_port, timeout=_SMTP_TIMEOUT) as server:
        server.ehlo()
        server.starttls()
        server.ehlo()
        server.login(settings.mail_username, settings.mail_password)
        server.sendmail(settings.mail_from, [to], msg.as_string())

    logger.info("Email sent → %s | Subject: %s", to, subject)


async def send_email(to: str, subject: str, html_body: str) -> None:
    """Non-blocking wrapper: dispatches _send_sync to the default thread executor."""
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, _send_sync, to, subject, html_body)


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
    await send_email(to, "Your mediaERP password reset code", html)
