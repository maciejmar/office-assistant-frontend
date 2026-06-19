import logging
import re
from datetime import datetime

logger = logging.getLogger(__name__)

POLISH_MONTHS = {
    1: "Styczeń", 2: "Luty", 3: "Marzec", 4: "Kwiecień",
    5: "Maj", 6: "Czerwiec", 7: "Lipiec", 8: "Sierpień",
    9: "Wrzesień", 10: "Październik", 11: "Listopad", 12: "Grudzień",
}

HEADER = ["Data", "Nadawca / Firma", "Kwota", "Typ", "Opis"]


def _parse_facts(facts_combined: str) -> list[list[str]]:
    rows = []
    for line in facts_combined.splitlines():
        line = line.strip()
        if not line or line.startswith("---") or line.startswith("#"):
            continue
        parts = [p.strip() for p in line.split("|")]
        if len(parts) < 4:
            continue
        # pad to 5 columns
        while len(parts) < 5:
            parts.append("")
        rows.append(parts[:5])
    return rows


def write_monthly_report(
    spreadsheet_id: str,
    service_account_file: str,
    facts_combined: str,
    month: int | None = None,
) -> int:
    """Write extracted financial facts to the monthly tab. Returns number of rows written."""
    import gspread
    from google.oauth2.service_account import Credentials

    scopes = [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive",
    ]

    creds = Credentials.from_service_account_file(service_account_file, scopes=scopes)
    gc = gspread.authorize(creds)
    sh = gc.open_by_key(spreadsheet_id)

    month_name = POLISH_MONTHS[month or datetime.utcnow().month]

    try:
        ws = sh.worksheet(month_name)
    except gspread.WorksheetNotFound:
        ws = sh.add_worksheet(title=month_name, rows=500, cols=10)
        ws.append_row(HEADER, value_input_option="USER_ENTERED")
        logger.info("Created new sheet tab '%s'", month_name)

    # Ensure header if sheet was empty
    existing = ws.get_all_values()
    if not existing:
        ws.append_row(HEADER, value_input_option="USER_ENTERED")
    elif existing[0] != HEADER:
        ws.insert_row(HEADER, index=1, value_input_option="USER_ENTERED")

    rows = _parse_facts(facts_combined)
    if rows:
        ws.append_rows(rows, value_input_option="USER_ENTERED")
        logger.info("Wrote %d rows to Google Sheets tab '%s'", len(rows), month_name)

    return len(rows)
