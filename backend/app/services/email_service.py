"""
Extended email helpers for scheduled reports and rule alert notifications.
Builds on top of app.utils.email which handles the actual SMTP transport.
"""
import logging
from datetime import datetime, timezone
from typing import List

from app.utils.email import send_email

logger = logging.getLogger(__name__)


async def send_rule_alert_email(recipients: List[str], subject: str, body_text: str) -> None:
    """Send a plain-text rule-alert email to one or more recipients."""
    html = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
    <tr><td align="center">
      <table width="540" cellpadding="0" cellspacing="0"
             style="background:#fff;border-radius:12px;overflow:hidden;
                    box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#18181b;padding:24px 32px;">
            <span style="font-size:18px;font-weight:700;color:#fff;">mediaERP</span>
            <span style="font-size:13px;color:#a1a1aa;margin-left:12px;">Automated Alert</span>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px;">
            <h2 style="margin:0 0 16px;font-size:18px;color:#dc2626;">Rule Alert Triggered</h2>
            <pre style="font-size:14px;color:#374151;line-height:1.7;
                        background:#f9fafb;border-radius:8px;padding:16px;
                        white-space:pre-wrap;word-break:break-word;margin:0;">
{body_text}
            </pre>
          </td>
        </tr>
        <tr>
          <td style="background:#f9f9f9;padding:14px 32px;border-top:1px solid #eee;">
            <p style="margin:0;font-size:12px;color:#aaa;">
              &copy; {datetime.now().year} mediaERP &mdash; Carlton Trading Academy
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""
    for recipient in recipients:
        try:
            await send_email(recipient, subject, html)
        except Exception as exc:
            logger.warning("Failed to send alert email to %s: %s", recipient, exc)


def _build_report_html(
    report_name: str,
    date_from: str,
    date_to: str,
    rows: List[dict],
) -> str:
    """Render an HTML email report from marketing_data rows."""
    metrics = ["impressions", "clicks", "spend", "ctr", "cpa", "roas"]
    header_cells = "".join(
        f'<th style="{_th}">{m.upper()}</th>' for m in metrics
    )

    def _fmt(v, metric):
        if v is None:
            return "-"
        if metric == "spend":
            return f"${v:,.2f}"
        if metric in ("ctr", "roas"):
            return f"{v:.2f}"
        if metric == "cpa":
            return f"${v:.2f}"
        return f"{v:,.0f}"

    body_rows = ""
    for row in rows:
        m = row.get("metrics", {})
        cells = "".join(
            f'<td style="{_td}">{_fmt(m.get(metric), metric)}</td>'
            for metric in metrics
        )
        body_rows += f"""<tr>
          <td style="{_td}">{row.get("date","")}</td>
          <td style="{_td}">{row.get("platform","")}</td>
          <td style="{_td}">{row.get("campaign_name","")}</td>
          {cells}
        </tr>"""

    if not rows:
        body_rows = (
            f'<tr><td colspan="{3 + len(metrics)}" style="{_td};text-align:center;color:#9ca3af;">'
            "No data for this period.</td></tr>"
        )

    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    return f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
    <tr><td align="center">
      <table width="720" cellpadding="0" cellspacing="0"
             style="background:#fff;border-radius:12px;overflow:hidden;
                    box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#18181b;padding:24px 32px;">
            <span style="font-size:18px;font-weight:700;color:#fff;">mediaERP</span>
            <span style="font-size:13px;color:#a1a1aa;margin-left:12px;">Performance Report</span>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px 12px;">
            <h2 style="margin:0 0 6px;font-size:20px;color:#111827;">{report_name}</h2>
            <p style="margin:0;font-size:13px;color:#6b7280;">
              Period: {date_from} to {date_to} &nbsp;&bull;&nbsp; Generated: {now_str}
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="border-collapse:collapse;border-radius:8px;overflow:hidden;
                           border:1px solid #e5e7eb;">
              <thead>
                <tr style="background:#f9fafb;">
                  <th style="{_th}">Date</th>
                  <th style="{_th}">Platform</th>
                  <th style="{_th}">Campaign</th>
                  {header_cells}
                </tr>
              </thead>
              <tbody>
                {body_rows}
              </tbody>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#f9f9f9;padding:14px 32px;border-top:1px solid #eee;">
            <p style="margin:0;font-size:12px;color:#aaa;">
              &copy; {datetime.now().year} mediaERP &mdash; Carlton Trading Academy
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


_th = (
    "padding:10px 12px;text-align:left;font-size:12px;font-weight:600;"
    "color:#6b7280;white-space:nowrap;border-bottom:1px solid #e5e7eb;"
)
_td = (
    "padding:9px 12px;font-size:13px;color:#374151;border-bottom:1px solid #f3f4f6;"
)


async def send_report_email(
    recipients: List[str],
    schedule_name: str,
    date_from: str,
    date_to: str,
    rows: List[dict],
) -> None:
    """Send the HTML performance-report email to all recipients."""
    html = _build_report_html(schedule_name, date_from, date_to, rows)
    subject = f"[mediaERP] {schedule_name} — {date_from} to {date_to}"
    for recipient in recipients:
        try:
            await send_email(recipient, subject, html)
            logger.info("Report email sent to %s", recipient)
        except Exception as exc:
            logger.warning("Failed to send report to %s: %s", recipient, exc)
