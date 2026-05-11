# Google Sheets Sync — One-Time Setup

Follow these steps once. After that, every time PROJECT_STATUS.md is saved,
the Google Sheet updates automatically.

---

## Step 1 — Install Python packages

```bash
pip install -r scripts/requirements_sync.txt
```

---

## Step 2 — Create a Google Cloud Service Account

1. Go to https://console.cloud.google.com/
2. Create a new project (or select an existing one) — name it e.g. `mediaERP`
3. In the left sidebar → **APIs & Services → Library**
4. Search for **Google Sheets API** → Enable it
5. Search for **Google Drive API** → Enable it
6. Go to **APIs & Services → Credentials**
7. Click **Create Credentials → Service Account**
   - Name: `mediaerp-sync`
   - Click **Done**
8. Click the service account you just created
9. Go to the **Keys** tab → **Add Key → Create new key → JSON**
10. A `.json` file downloads automatically

---

## Step 3 — Place credentials file

Rename the downloaded file to `credentials.json` and put it here:

```
mediaERP/
└── scripts/
    └── credentials.json   ← here
```

> credentials.json is in .gitignore — it will NOT be committed.

---

## Step 4 — Share the Google Sheet with the service account

1. Open `credentials.json` and copy the `client_email` value
   - It looks like: `mediaerp-sync@your-project.iam.gserviceaccount.com`
2. Open your Google Sheet:
   https://docs.google.com/spreadsheets/d/1duJkhiOOMpLEy1hBtdwjHz1Z2FTdZly2m_jN6_I5wjw/edit
3. Click **Share** (top right)
4. Paste the service account email → set role to **Editor** → Send

---

## Step 5 — Test manually

```bash
python scripts/sync_to_sheets.py
```

Expected output:
```
[sync] Reading PROJECT_STATUS.md ...
[sync] Parsed — 67 features | 0 done | 0 in-progress
[sync] Connecting to Google Sheets ...
[sync] Connected: 'mediaERP PM'
[sync] 'Task Tracker' — 0 status cells updated
[sync] 'Project Roadmap' — 0 phase status cells updated
[sync] 'Sync Summary' tab updated
[sync] DONE — 0 cells synced at 12:00 UTC
```

---

## Step 6 — Verify the auto-hook is active

The Claude Code hook in `.claude/settings.json` runs the sync script
automatically every time PROJECT_STATUS.md is saved.

To test: change any ⬜ to ✅ in PROJECT_STATUS.md and save it.
Check your Google Sheet within seconds — the Status column should update.

---

## How the sync works

```
PROJECT_STATUS.md  →  sync_to_sheets.py  →  Google Sheet
     (source)              (parser)            (target)

Status emoji mapping:
  ✅  →  Done
  🔵  →  In Progress
  🔴  →  Blocked
  ⬜  →  Not Started
```

The script:
1. Parses every `| feature-id | ... | ✅/🔵/🔴/⬜ | notes |` row
2. Finds matching rows in Google Sheet by feature ID in column `#`
3. Updates the Status column and Notes/PR Link column
4. Updates phase-level Status and Progress % in the Roadmap sheet
5. Writes a `Sync Summary` tab with overall progress + per-phase breakdown
