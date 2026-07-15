# mediaERP — Email Sending Documentation

> Complete reference for **every place the project sends email**, how the transport
> works, how it's configured, and how sends are now logged & monitored.
>
> Related: [project-doc.md](project-doc.md) · [routes.md](routes.md) · [api.doc.md](api.doc.md)

---

## 1. How email works (architecture)

All outbound email funnels through **one transport module**:
[`backend/app/utils/email.py`](backend/app/utils/email.py).

```
callers ─► send_email() / send_email_db() ─► _send_sync() (thread pool, smtplib)
                                                    │
                                                    └─► _log_email() → email_logs collection
```

| Function | SMTP config source | Used by |
|----------|--------------------|---------|
| `send_email(to, subject, html, category)` | **`.env`** (`MAIL_*`) | Most callers (OTP, reports, alerts, invites) |
| `send_email_db(db, to, subject, html, category)` | **DB** (`email_settings`) → `.env` fallback | SMTP test button only |
| `send_otp_email(to, otp)` | via `send_email` | Password reset |
| `_send_sync(...)` | resolves host/port/user/pass | The actual `smtplib` send (runs in a thread pool) |

- The send runs in a **thread-pool executor** so it never blocks the FastAPI event loop.
- **Port behaviour:** `465` → SMTP_SSL; `587` → STARTTLS (standard Gmail App-Password flow); other → STARTTLS when `use_tls`.
- Gmail requires a **16-char App Password**, not the account password — a friendly error is surfaced on `SMTPAuthenticationError`.

---

## 2. SMTP configuration

Config is resolved with this priority (in `_send_sync`):

1. **`email_settings` collection** (singleton doc `_id: "smtp"`) — set via the UI at
   **Super Admin › Settings › Email/SMTP** (`PUT /api/v1/settings/email-smtp`). Fields:
   `host, port, username, password, from_email, from_name, use_tls`.
2. **`.env`** fallback (`backend/.env`): `MAIL_SERVER, MAIL_PORT, MAIL_USERNAME,
   MAIL_PASSWORD, MAIL_FROM, MAIL_FROM_NAME`.

> ⚠️ **Important operational caveat (as of this writing):** the `email_settings`
> collection **is** configured (Gmail `lisabdemmahum@gmail.com`), but `backend/.env`
> `MAIL_*` values are **empty**. Because `send_email()` reads **`.env` only**, every
> caller that uses `send_email()` (password resets, scheduled reports, rule alerts,
> client invites) currently **fails** — only `send_email_db()` (the "Test SMTP" button)
> uses the DB config and works. See §5 for the fix.

---

## 3. Every email the project sends

| # | Feature | Trigger | Function chain | `category` | SMTP source |
|---|---------|---------|----------------|------------|-------------|
| 1 | **Password reset OTP** | `POST /api/v1/auth/forgot-password` | `send_otp_email` → `send_email` | `password_reset` | `.env` |
| 2 | **Scheduled performance report** | Email scheduler daemon (fires due `email_schedules`) | `email_report_service.send_schedule_report` → `send_report_email` → `send_email` | `report` | `.env` |
| 3 | **Send report now** | `POST /api/v1/email-reports/send-now/{id}` | → `send_report_email` → `send_email` | `report` | `.env` |
| 4 | **Report test email** | `POST /api/v1/email-reports/test-email` | `send_email` | `smtp_test` | `.env` |
| 5 | **Rule alert email** | Rules evaluator daemon (threshold breached, action=`email`) | `send_rule_alert_email` → `send_email` | `rule_alert` | `.env` |
| 6 | **Client invitation** | `POST /api/v1/clients/{id}/invite` | `send_email` | `client_invite` | `.env` |
| 7 | **SMTP test** | `POST /api/v1/settings/email-smtp/test` | `send_email_db` | `smtp_test` | **DB** |

Templates are inline HTML built in `utils/email.py` (OTP), `services/email_service.py`
(report table, rule alert), and `routers/clients.py` (invite). Branding: "mediaERP —
Carlton Trading Academy".

---

## 4. Email logs (audit trail) — Super Admin

Every send attempt — success **or** failure — is now recorded by
`_log_email()` into the **`email_logs`** collection:

```jsonc
{
  "to": "user@example.com",
  "subject": "Your mediaERP password reset code",
  "status": "sent" | "failed",
  "error": "Authentication failed (535)" | null,
  "from_email": "lisabdemmahum@gmail.com",
  "category": "password_reset",   // report | rule_alert | client_invite | smtp_test | general
  "created_at": "2026-07-15T…Z"
}
```

- Logging uses the **synchronous PyMongo** client (`get_sync_db()`) because `_send_sync`
  runs in a thread pool that's also reached from the scheduler daemon threads (the async
  Motor client is bound to the main event loop). Logging failures are swallowed so they
  can never break delivery.
- Indexes: `created_at ↓`, `(status, created_at ↓)`, `(category, created_at ↓)`.

### Viewing logs
- **API:** `GET /api/v1/email-logs?page=&limit=&status=&category=&search=` — **Super Admin only**
  (403 otherwise). Returns `{ logs, total, page, pages, stats:{sent,failed,total} }`.
- **UI:** `/email-logs` page (sidebar link **visible to Super Admin only**) — stats cards
  (Total / Sent / Failed), search, status filter, and a table of Category · To · Subject ·
  Status · Sent-at · Error.

---

## 5. Known issue & recommended fix

**Problem:** working SMTP lives in the **DB** (`email_settings`), but `send_email()` reads
**`.env`** (empty) → all real emails (OTP, reports, alerts, invites) fail. The Email Logs
page now makes this visible (rows with `status: failed`, error "Email not configured").

**Fix options:**
1. **Populate `backend/.env`** with the same SMTP creds as the DB (`MAIL_USERNAME`,
   `MAIL_PASSWORD` = the Gmail App Password, `MAIL_FROM`, `MAIL_SERVER=smtp.gmail.com`,
   `MAIL_PORT=587`), **or**
2. **Route `send_email()` through the DB config** like `send_email_db()` (make the DB the
   single source of truth). This needs a DB handle available to the daemon-thread callers.

Also recommended: change the sender from the personal Gmail `lisabdemmahum@gmail.com` to a
`@deltainstitutions.com` mailbox so staff emails don't look like phishing / land in spam.

---

## 6. Files involved

| File | Role |
|------|------|
| `backend/app/utils/email.py` | Transport, SMTP resolution, `_log_email`, OTP template |
| `backend/app/services/email_service.py` | Report + rule-alert HTML builders & senders |
| `backend/app/services/email_report_service.py` | Scheduled-report daemon |
| `backend/app/routers/email_reports.py` | Report schedules CRUD, send-now, test |
| `backend/app/routers/email_settings.py` | SMTP config (Super Admin) + test |
| `backend/app/routers/clients.py` | Client invite email |
| `backend/app/routers/auth.py` | Forgot-password (OTP) |
| `backend/app/routers/email_logs.py` | **Email logs API (Super Admin)** |
| `frontend/app/(dashboard)/email-logs/page.tsx` | **Email logs UI (Super Admin)** |
| `frontend/hooks/useEmailLogs.ts` | Email logs data hook |
