import io
import re
import smtplib
import logging
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import httpx
from pypdf import PdfReader

from ..config import settings
from ..db import SessionLocal
from ..models import File, Newsletter, NewsletterJob, SendLog
from ..storage import load_file
from .state import NewsletterState

logger = logging.getLogger(__name__)

MAX_COMBINED_CHARS = 14_000


def _db():
    return SessionLocal()


# ── helpers ──────────────────────────────────────────────────────────────────

def _extract_text(data: bytes, filename: str, mime: str) -> str:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if mime == "application/pdf" or ext == "pdf":
        reader = PdfReader(io.BytesIO(data))
        return "\n".join(p.extract_text() or "" for p in reader.pages).strip()

    if ext in {"txt", "md", "csv"} or (mime or "").startswith("text/"):
        return data.decode("utf-8", errors="replace")

    if ext == "docx":
        from docx import Document  # type: ignore
        doc = Document(io.BytesIO(data))
        return "\n".join(p.text for p in doc.paragraphs).strip()

    return ""


def _strip_code_fence(text: str) -> str:
    text = re.sub(r"^```[a-zA-Z]*\n?", "", text.strip())
    text = re.sub(r"\n?```$", "", text.strip())
    return text.strip()


def _parse_llm_output(raw: str) -> tuple[str, str, str]:
    s = re.search(r"===SUBJECT===\s*(.*?)\s*===HTML===", raw, re.DOTALL)
    h = re.search(r"===HTML===\s*(.*?)\s*===TEXT===", raw, re.DOTALL)
    t = re.search(r"===TEXT===\s*(.*?)(?:===|$)", raw, re.DOTALL)
    subject   = _strip_code_fence(s.group(1)) if s else "Newsletter"
    html_body = _strip_code_fence(h.group(1)) if h else f"<p>{raw}</p>"
    text_body = _strip_code_fence(t.group(1)) if t else raw
    return subject, html_body, text_body


def _send_one(to: str, subject: str, html: str, text: str) -> None:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from
    msg["To"] = to
    msg.attach(MIMEText(text, "plain", "utf-8"))
    msg.attach(MIMEText(html, "html", "utf-8"))
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as s:
        s.sendmail(settings.smtp_from, to, msg.as_string())


# ── nodes ─────────────────────────────────────────────────────────────────────

def mark_running(state: NewsletterState) -> NewsletterState:
    db = _db()
    try:
        job = db.query(NewsletterJob).filter(NewsletterJob.id == state["job_id"]).first()
        if job:
            job.status = "running"
            job.started_at = datetime.utcnow()
            db.commit()
    except Exception as e:
        logger.warning("mark_running DB error: %s", e)
    finally:
        db.close()
    return state


def extract_texts(state: NewsletterState) -> NewsletterState:
    db = _db()
    try:
        files = (
            db.query(File)
            .filter(File.user_id == state["user_id"], File.id.in_(state["file_ids"]))
            .all()
        )
        parts: list[str] = []
        for f in files:
            try:
                data = load_file(f)
                text = _extract_text(data, f.filename or "", f.mime or "")
                if text.strip():
                    parts.append(f"=== {f.filename} ===\n{text.strip()}")
            except Exception as e:
                logger.warning("Skipping file %s: %s", f.filename, e)

        if not parts:
            return {**state, "error": "Nie udało się odczytać tekstu z żadnego z wybranych plików."}

        combined = "\n\n".join(parts)
        if len(combined) > MAX_COMBINED_CHARS:
            combined = combined[:MAX_COMBINED_CHARS] + "\n...[tekst skrócony]"

        return {**state, "combined_text": combined, "error": None}
    except Exception as e:
        return {**state, "error": str(e)}
    finally:
        db.close()


def generate_newsletter(state: NewsletterState) -> NewsletterState:
    if state.get("error"):
        return state

    tone_map = {
        "professional": "profesjonalny i formalny" if state["language"] == "pl" else "professional and formal",
        "friendly":     "ciepły i przyjazny"       if state["language"] == "pl" else "warm and friendly",
        "concise":      "zwięzły i konkretny"       if state["language"] == "pl" else "concise and to-the-point",
    }
    tone_desc = tone_map.get(state["tone"], state["tone"])
    lang_desc = "polskim" if state["language"] == "pl" else "English"

    prompt = f"""Jesteś ekspertem od pisania newsletterów. Na podstawie poniższych dokumentów stwórz newsletter.

DOKUMENTY ŹRÓDŁOWE:
{state["combined_text"]}

WYMAGANIA:
- Język: {lang_desc}
- Ton: {tone_desc}
- Maksymalna długość treści: {state["max_length"]} słów
- Newsletter powinien syntetyzować kluczowe informacje z dokumentów

Odpowiedz WYŁĄCZNIE w poniższym formacie, używając dokładnie tych markerów:

===SUBJECT===
(temat wiadomości e-mail)

===HTML===
(treść newslettera jako fragment HTML: używaj <h2>, <p>, <ul>, <li>, <strong>, <em> — bez tagów <html>/<body>/<head>)

===TEXT===
(ta sama treść w wersji plain text, bez tagów HTML)"""

    try:
        with httpx.Client(timeout=300) as client:
            resp = client.post(
                f"{settings.ollama_url}/api/generate",
                json={"model": settings.ollama_model, "prompt": prompt, "stream": False},
            )
            resp.raise_for_status()
            raw = resp.json().get("response", "")

        subject, html_body, text_body = _parse_llm_output(raw)
        return {**state, "subject": subject, "html_body": html_body, "text_body": text_body, "error": None}

    except Exception as e:
        return {**state, "error": f"Generowanie przez LLM nie powiodło się: {e}"}


def save_newsletter(state: NewsletterState) -> NewsletterState:
    if state.get("error"):
        return state

    db = _db()
    try:
        newsletter = Newsletter(
            job_id=state["job_id"],
            subject=state["subject"],
            html_body=state["html_body"],
            text_body=state["text_body"],
            created_at=datetime.utcnow(),
        )
        db.add(newsletter)
        db.flush()

        job = db.query(NewsletterJob).filter(NewsletterJob.id == state["job_id"]).first()
        if job:
            job.status = "done"
            job.finished_at = datetime.utcnow()

        db.commit()
        db.refresh(newsletter)
        return {**state, "newsletter_id": newsletter.id, "error": None}

    except Exception as e:
        db.rollback()
        return {**state, "error": f"Zapis newslettera nie powiódł się: {e}"}
    finally:
        db.close()


def send_emails(state: NewsletterState) -> NewsletterState:
    emails = state.get("subscriber_emails") or []
    if not emails:
        return state  # tryb preview — brak wysyłki

    db = _db()
    try:
        for addr in emails:
            try:
                _send_one(addr, state["subject"], state["html_body"], state["text_body"])
                status = "sent"
            except Exception as e:
                logger.error("Wysyłka do %s nie powiodła się: %s", addr, e)
                status = "failed"

            db.add(SendLog(
                newsletter_id=state["newsletter_id"],
                subscriber_email=addr,
                status=status,
                sent_at=datetime.utcnow(),
            ))
        db.commit()
    finally:
        db.close()
    return state


def mark_failed(state: NewsletterState) -> NewsletterState:
    db = _db()
    try:
        job = db.query(NewsletterJob).filter(NewsletterJob.id == state["job_id"]).first()
        if job:
            job.status = "failed"
            job.error = state.get("error") or "Nieznany błąd"
            job.finished_at = datetime.utcnow()
            db.commit()
    except Exception as e:
        logger.error("mark_failed DB error: %s", e)
    finally:
        db.close()
    return state
