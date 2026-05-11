"""
sync_to_sheets.py
-----------------
Reads PROJECT_STATUS.md and pushes status updates to the mediaERP Google Sheet.
Triggered automatically by a Claude Code hook on every PROJECT_STATUS.md save.

Google Sheet ID: 1duJkhiOOMpLEy1hBtdwjHz1Z2FTdZly2m_jN6_I5wjw

Setup (one-time):
  1. pip install gspread google-auth
  2. Create a Google Cloud service account and download credentials.json
     → Place credentials.json next to this file (scripts/credentials.json)
  3. Share the Google Sheet with the service account email (Editor access)
  4. Run once manually:  python scripts/sync_to_sheets.py
"""

import re
import sys
import json
import os
from pathlib import Path
from datetime import datetime

try:
    import gspread
    from google.oauth2.service_account import Credentials
except ImportError:
    print("[sync] ERROR: Missing packages. Run: pip install gspread google-auth")
    sys.exit(1)

# ── Config ────────────────────────────────────────────────────────────────────
SHEET_ID      = "1duJkhiOOMpLEy1hBtdwjHz1Z2FTdZly2m_jN6_I5wjw"
CREDS_FILE    = Path(__file__).parent / "credentials.json"
STATUS_FILE   = Path(__file__).parent.parent / "PROJECT_STATUS.md"
SCOPES        = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.file",
]

# Maps markdown status emoji → sheet text
STATUS_MAP = {
    "✅": "Done",
    "🔵": "In Progress",
    "🔴": "Blocked",
    "⬜": "Not Started",
}

# ── Parser ────────────────────────────────────────────────────────────────────

def parse_status_md(path: Path) -> dict:
    """
    Returns:
        {
          "phases": { "1": "Not Started", "2": "Done", ... },
          "features": { "1.1": {"status": "Done", "notes": "..."}, ... },
          "last_updated": "2026-05-05",
          "overall": { "done": 3, "in_progress": 1, "not_started": 63, "total": 67 }
        }
    """
    text = path.read_text(encoding="utf-8")
    result = {"phases": {}, "features": {}, "last_updated": "", "overall": {}}

    # Last Updated line
    m = re.search(r"\*\*Date:\*\*\s+(.+)", text)
    if m:
        result["last_updated"] = m.group(1).strip()

    # Feature rows: | 1.1 | Feature name | ✅ / 🔵 / 🔴 / ⬜ | notes |
    feat_pattern = re.compile(
        r"\|\s*([\d]+\.[\d]+)\s*\|[^|]+\|[^|]*?"
        r"(✅|🔵|🔴|⬜)[^|]*\|([^|]*)\|"
    )
    for m in feat_pattern.finditer(text):
        fid, emoji, notes = m.group(1), m.group(2), m.group(3).strip()
        result["features"][fid] = {
            "status": STATUS_MAP.get(emoji, "Not Started"),
            "notes": notes,
        }

    # Phase rows (Overall Progress table): | 1 — Scaffold + Auth | 3 | 14 | ...
    phase_pattern = re.compile(
        r"\|\s*\*\*?(\d+)\s*[—-][^|]+\*\*?\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|"
    )
    for m in phase_pattern.finditer(text):
        ph_num, done, total = m.group(1), int(m.group(2)), int(m.group(3))
        pct = round(done / total * 100) if total else 0
        status = "Done" if done == total else ("In Progress" if done > 0 else "Not Started")
        result["phases"][ph_num] = {"done": done, "total": total, "pct": pct, "status": status}

    # Overall
    all_features = list(result["features"].values())
    done_count = sum(1 for f in all_features if f["status"] == "Done")
    ip_count   = sum(1 for f in all_features if f["status"] == "In Progress")
    bl_count   = sum(1 for f in all_features if f["status"] == "Blocked")
    ns_count   = sum(1 for f in all_features if f["status"] == "Not Started")
    result["overall"] = {
        "done": done_count, "in_progress": ip_count,
        "blocked": bl_count, "not_started": ns_count,
        "total": len(all_features),
        "pct": round(done_count / len(all_features) * 100) if all_features else 0,
    }

    return result


# ── Google Sheets helpers ─────────────────────────────────────────────────────

def connect() -> gspread.Spreadsheet:
    if not CREDS_FILE.exists():
        print(f"[sync] ERROR: credentials.json not found at {CREDS_FILE}")
        print("[sync]   → Follow the setup steps in scripts/SETUP_GOOGLE.md")
        sys.exit(1)
    creds = Credentials.from_service_account_file(str(CREDS_FILE), scopes=SCOPES)
    gc = gspread.authorize(creds)
    return gc.open_by_key(SHEET_ID)


def find_col(header_row: list, *names: str) -> int | None:
    """Return 1-based column index of the first matching header name (case-insensitive)."""
    for name in names:
        for i, h in enumerate(header_row):
            if h and name.lower() in str(h).lower():
                return i + 1
    return None


def sync_task_tracker(ws: gspread.Worksheet, data: dict) -> int:
    """
    Finds the header row, then updates Status / Progress % / Notes
    for every feature row whose ID matches data['features'].
    Returns count of cells updated.
    """
    all_values = ws.get_all_values()
    if not all_values:
        print(f"[sync] Sheet '{ws.title}' is empty — skipping.")
        return 0

    # Locate header row (contains '#' or 'Feature')
    header_row_idx = None
    header = []
    for i, row in enumerate(all_values):
        if any(h.strip().lower() in ("#", "feature", "status") for h in row):
            header_row_idx = i
            header = row
            break

    if header_row_idx is None:
        print(f"[sync] Could not find header row in '{ws.title}' — skipping.")
        return 0

    col_id     = find_col(header, "#", "id", "task id")
    col_status = find_col(header, "status")
    col_notes  = find_col(header, "notes", "pr link")

    if not col_id or not col_status:
        print(f"[sync] Could not locate ID or Status column in '{ws.title}' — skipping.")
        return 0

    updates = []
    updated = 0
    now_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")

    for row_idx, row in enumerate(all_values):
        if row_idx <= header_row_idx:
            continue
        cell_id = str(row[col_id - 1]).strip() if col_id <= len(row) else ""
        if not cell_id or cell_id not in data["features"]:
            continue

        feat = data["features"][cell_id]
        excel_row = row_idx + 1  # gspread is 1-based

        # Status
        current_status = row[col_status - 1].strip() if col_status <= len(row) else ""
        if current_status != feat["status"]:
            updates.append({"range": gspread.utils.rowcol_to_a1(excel_row, col_status),
                            "values": [[feat["status"]]]})
            updated += 1

        # Notes (only if feat has notes and col exists)
        if col_notes and feat["notes"]:
            current_notes = row[col_notes - 1].strip() if col_notes <= len(row) else ""
            if current_notes != feat["notes"]:
                updates.append({"range": gspread.utils.rowcol_to_a1(excel_row, col_notes),
                                "values": [[feat["notes"]]]})

    if updates:
        ws.batch_update(updates)

    return updated


def sync_roadmap(ws: gspread.Worksheet, data: dict) -> int:
    """
    Updates Phase-level Status and Progress % columns in the roadmap sheet.
    """
    all_values = ws.get_all_values()
    if not all_values:
        return 0

    header_row_idx = None
    header = []
    for i, row in enumerate(all_values):
        if any(h.strip().lower() in ("phase", "status", "progress") for h in row):
            header_row_idx = i
            header = row
            break

    if header_row_idx is None:
        return 0

    col_wk      = find_col(header, "wk", "week", "phase #", "#")
    col_status  = find_col(header, "status")
    col_pct     = find_col(header, "progress")

    if not col_status:
        return 0

    updates = []
    updated = 0

    for row_idx, row in enumerate(all_values):
        if row_idx <= header_row_idx:
            continue
        wk_val = str(row[col_wk - 1]).strip() if col_wk and col_wk <= len(row) else ""
        # Try to extract phase number (handles "1", "3-4", "4-5" etc.)
        ph_num = re.match(r"^(\d+)", wk_val)
        if not ph_num:
            continue
        ph_key = ph_num.group(1)
        if ph_key not in data["phases"]:
            continue

        ph = data["phases"][ph_key]
        excel_row = row_idx + 1

        current_status = row[col_status - 1].strip() if col_status <= len(row) else ""
        if current_status != ph["status"]:
            updates.append({"range": gspread.utils.rowcol_to_a1(excel_row, col_status),
                            "values": [[ph["status"]]]})
            updated += 1

        if col_pct:
            pct_display = f"{ph['pct']}%"
            current_pct = str(row[col_pct - 1]).strip() if col_pct <= len(row) else ""
            if current_pct != pct_display:
                updates.append({"range": gspread.utils.rowcol_to_a1(excel_row, col_pct),
                                "values": [[pct_display]]})

    if updates:
        ws.batch_update(updates)
    return updated


def write_summary_tab(spreadsheet: gspread.Spreadsheet, data: dict):
    """
    Writes / updates a 'Sync Summary' tab with overall progress and timestamp.
    Creates the tab if it doesn't exist.
    """
    try:
        ws = spreadsheet.worksheet("Sync Summary")
    except gspread.WorksheetNotFound:
        ws = spreadsheet.add_worksheet("Sync Summary", rows=30, cols=6)

    o = data["overall"]
    now_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    rows = [
        ["mediaERP — Project Progress", "", "", "", "", ""],
        ["Last synced", now_str, "", "", "", ""],
        ["Last STATUS update", data.get("last_updated", ""), "", "", "", ""],
        ["", "", "", "", "", ""],
        ["Metric", "Count", "Percentage", "", "", ""],
        ["Total Features", o["total"], "", "", "", ""],
        ["Done", o["done"], f"{o['pct']}%", "", "", ""],
        ["In Progress", o["in_progress"], f"{round(o['in_progress']/o['total']*100) if o['total'] else 0}%", "", "", ""],
        ["Blocked", o["blocked"], f"{round(o['blocked']/o['total']*100) if o['total'] else 0}%", "", "", ""],
        ["Not Started", o["not_started"], f"{round(o['not_started']/o['total']*100) if o['total'] else 0}%", "", "", ""],
        ["", "", "", "", "", ""],
        ["Phase", "Done", "Total", "Progress", "Status", ""],
    ]
    phase_names = {
        "1": "Scaffold + Auth", "2": "Connector System", "3": "Sync Pipeline",
        "4": "Reports API", "5": "Dashboard UI", "6": "AI Layer",
        "7": "Settings + Notif.", "8": "Deployment",
    }
    for ph_key in sorted(data["phases"].keys(), key=int):
        ph = data["phases"][ph_key]
        rows.append([
            f"Ph{ph_key} — {phase_names.get(ph_key, '')}",
            ph["done"], ph["total"],
            f"{ph['pct']}%", ph["status"], ""
        ])

    ws.clear()
    ws.update("A1", rows)


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print(f"[sync] Reading {STATUS_FILE.name} ...")
    if not STATUS_FILE.exists():
        print("[sync] ERROR: PROJECT_STATUS.md not found.")
        sys.exit(1)

    data = parse_status_md(STATUS_FILE)
    print(f"[sync] Parsed — {data['overall']['total']} features | "
          f"{data['overall']['done']} done | {data['overall']['in_progress']} in-progress")

    print("[sync] Connecting to Google Sheets ...")
    spreadsheet = connect()
    print(f"[sync] Connected: '{spreadsheet.title}'")

    total_updated = 0

    for ws in spreadsheet.worksheets():
        title_lower = ws.title.lower()
        if any(k in title_lower for k in ("task", "tracker", "feature")):
            n = sync_task_tracker(ws, data)
            print(f"[sync] '{ws.title}' — {n} status cells updated")
            total_updated += n
        elif any(k in title_lower for k in ("roadmap", "phase", "plan")):
            n = sync_roadmap(ws, data)
            print(f"[sync] '{ws.title}' — {n} phase status cells updated")
            total_updated += n

    write_summary_tab(spreadsheet, data)
    print(f"[sync] 'Sync Summary' tab updated")
    print(f"[sync] DONE — {total_updated} cells synced at {datetime.utcnow().strftime('%H:%M UTC')}")


if __name__ == "__main__":
    main()
