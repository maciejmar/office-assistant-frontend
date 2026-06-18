import imaplib
import email
import email.header
import logging
import re
from dataclasses import dataclass
from datetime import datetime, timedelta
from email.utils import parsedate_to_datetime

logger = logging.getLogger(__name__)

AMOUNT_PATTERN = re.compile(
    r"\d[\d\s]*[.,]\d{2}\s*(?:zł|pln|eur|usd|gbp|euro|złotych)?",
    re.IGNORECASE,
)

PAYMENT_KEYWORDS = [
    "do zapłaty", "termin płatności", "termin zapłaty", "proszę o wpłatę",
    "należność", "kwota do zapłaty", "należy zapłacić", "zapłać",
    "pay by", "payment due", "amount due", "due date", "please pay",
    "faktura", "invoice", "rachunek", "bill",
    "rata", "składka", "podatek", "tax", "zus", "vat", "pit", "cit",
    "opłata", "fee", "subskrypcja", "subscription", "abonament",
    "przelew", "transfer", "wpłata", "deposit",
    "upomnienie", "wezwanie do zapłaty", "zaległość", "overdue", "reminder",
]


@dataclass
class EmailSummary:
    subject: str
    sender: str
    date: str
    snippet: str


def _decode_header(raw: str) -> str:
    parts = email.header.decode_header(raw or "")
    result = []
    for part, charset in parts:
        if isinstance(part, bytes):
            result.append(part.decode(charset or "utf-8", errors="replace"))
        else:
            result.append(part)
    return " ".join(result)


def _extract_text(msg: email.message.Message) -> str:
    text_parts = []
    for part in msg.walk():
        ct = part.get_content_type()
        if ct == "text/plain":
            charset = part.get_content_charset() or "utf-8"
            try:
                text_parts.append(part.get_payload(decode=True).decode(charset, errors="replace"))
            except Exception:
                pass
    if text_parts:
        return "\n".join(text_parts)
    # fallback: strip html
    for part in msg.walk():
        if part.get_content_type() == "text/html":
            charset = part.get_content_charset() or "utf-8"
            try:
                html = part.get_payload(decode=True).decode(charset, errors="replace")
                return re.sub(r"<[^>]+>", " ", html)
            except Exception:
                pass
    return ""


def _is_financial(subject: str, body: str) -> bool:
    combined = (subject + " " + body[:600]).lower()
    has_amount = bool(AMOUNT_PATTERN.search(combined))
    has_keyword = any(kw in combined for kw in PAYMENT_KEYWORDS)
    return has_amount or has_keyword


def fetch_financial_emails(
    imap_host: str,
    imap_port: int,
    username: str,
    password: str,
    days_back: int = 90,
    max_emails: int = 40,
) -> list[EmailSummary]:
    since_date = (datetime.utcnow() - timedelta(days=days_back)).strftime("%d-%b-%Y")

    with imaplib.IMAP4_SSL(imap_host, imap_port, timeout=30) as imap:
        imap.login(username, password.replace(" ", ""))
        imap.select("INBOX")

        _, ids = imap.search(None, f'(SINCE "{since_date}")')
        all_ids = ids[0].split() if ids[0] else []

        # newest first, limit to 200 to search through
        all_ids = list(reversed(all_ids[-200:]))

        results: list[EmailSummary] = []
        for uid in all_ids:
            if len(results) >= max_emails:
                break
            try:
                _, data = imap.fetch(uid, "(RFC822)")
                raw = data[0][1]
                msg = email.message_from_bytes(raw)

                subject = _decode_header(msg.get("Subject", ""))
                sender = _decode_header(msg.get("From", ""))
                date_raw = msg.get("Date", "")
                try:
                    date = parsedate_to_datetime(date_raw).strftime("%Y-%m-%d")
                except Exception:
                    date = date_raw[:16]

                body = _extract_text(msg)
                if not _is_financial(subject, body):
                    continue

                snippet = body.strip()[:200]
                results.append(EmailSummary(
                    subject=subject,
                    sender=sender,
                    date=date,
                    snippet=snippet,
                ))
            except Exception as e:
                logger.warning("Błąd odczytu maila uid=%s: %s", uid, e)

    return results
