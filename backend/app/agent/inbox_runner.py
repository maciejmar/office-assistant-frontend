import logging
import re
from datetime import datetime

from ..db import SessionLocal
from ..imap_reader import fetch_financial_emails, EmailSummary
from ..llm import call_llm
from ..models import InboxReportJob, UserSmtpConfig

logger = logging.getLogger(__name__)

CHUNK_SIZE = 15  # emails per LLM extraction pass


def _llm(prompt: str, user_id: int, operation: str) -> str:
    return call_llm(prompt, user_id=user_id, operation=operation, max_tokens=1500)


def _strip_fences(text: str) -> str:
    text = re.sub(r"^```[a-zA-Z]*\n?", "", text.strip())
    return re.sub(r"\n?```$", "", text.strip()).strip()


def _extract_facts(chunk: list[EmailSummary], chunk_no: int, total_chunks: int, user_id: int) -> str:
    """Pass 1: extract structured financial facts from a batch of emails."""
    emails_text = "\n\n".join(
        f"[{i+1}] Data: {e.date} | Od: {e.sender} | Temat: {e.subject}\nTreść: {e.snippet}"
        for i, e in enumerate(chunk)
    )
    prompt = f"""Z poniższych {len(chunk)} e-maili finansowych wyciągnij TYLKO kluczowe fakty finansowe.

E-MAILE (partia {chunk_no}/{total_chunks}):
{emails_text}

Dla każdego e-maila podaj w jednej linii:
DATA | NADAWCA/FIRMA | KWOTA (jeśli jest) | TYP (faktura/przelew/składka/podatek/rachunek/inne) | KRÓTKA NOTATKA

Jeśli nie ma kwoty napisz "-". Pisz po polsku. Tylko lista faktów, bez komentarzy."""

    return _llm(prompt, user_id=user_id, operation="inbox_extract")


def _generate_report(facts_combined: str, total: int, days_back: int, user_id: int) -> str:
    """Pass 2: generate HTML report from extracted facts."""
    prompt = f"""Jesteś asystentem finansowym. Na podstawie poniższych danych finansowych z {total} e-maili (ostatnie {days_back} dni) stwórz raport HTML.

WYCIĄGNIĘTE DANE FINANSOWE:
{facts_combined}

Stwórz raport HTML zawierający:
1. <h2>Podsumowanie</h2> — liczba transakcji, ogólny obraz
2. <h2>Płatności i przelewy</h2> — lista z datami i kwotami
3. <h2>Faktury i rachunki</h2> — jeśli występują
4. <h2>Składki i podatki</h2> — ZUS, US, VAT, PIT jeśli występują
5. <h2>Uwagi</h2> — zaległości lub ważne pozycje

ZASADY:
- Używaj WYŁĄCZNIE podanych danych
- NIE WYMYŚLAJ kwot ani nazw których nie ma w danych
- Tylko fragment HTML: <h2>, <h3>, <p>, <ul>, <li>, <strong>, <table>, <tr>, <td>, <th>
- Pisz po polsku
- Maksymalnie 700 słów"""

    raw = _llm(prompt, user_id=user_id, operation="inbox_report")
    return _strip_fences(raw)


def run_inbox_report(
    job_id: int,
    user_id: int,
    days_back: int,
    max_emails: int,
    imap_host: str | None = None,
    imap_port: int = 993,
    username: str | None = None,
    password: str | None = None,
) -> None:
    db = SessionLocal()
    try:
        job = db.query(InboxReportJob).filter(InboxReportJob.id == job_id).first()
        if not job:
            return
        job.status = "running"
        db.commit()

        if not imap_host or not username or not password:
            cfg = db.query(UserSmtpConfig).filter(UserSmtpConfig.user_id == user_id).first()
            if not cfg or not cfg.imap_host:
                job.status = "failed"
                job.error = "Brak konfiguracji IMAP. Uzupełnij serwer IMAP w Ustawieniach lub podaj dane ręcznie."
                job.finished_at = datetime.utcnow()
                db.commit()
                return
            imap_host = imap_host or cfg.imap_host
            imap_port = imap_port or cfg.imap_port or 993
            username = username or cfg.username
            password = password or cfg.password

        try:
            emails = fetch_financial_emails(
                imap_host=imap_host,
                imap_port=imap_port,
                username=username,
                password=password,
                days_back=days_back,
                max_emails=max_emails,
            )
        except Exception as e:
            job.status = "failed"
            job.error = f"Błąd połączenia IMAP: {e}"
            job.finished_at = datetime.utcnow()
            db.commit()
            return

        if not emails:
            job.status = "done"
            job.result_html = "<p>Nie znaleziono wiadomości dotyczących płatności i rachunków w podanym okresie.</p>"
            job.email_count = 0
            job.finished_at = datetime.utcnow()
            db.commit()
            return

        # Pass 1: extract facts in chunks
        chunks = [emails[i:i+CHUNK_SIZE] for i in range(0, len(emails), CHUNK_SIZE)]
        facts_parts = []
        try:
            for idx, chunk in enumerate(chunks, 1):
                facts = _extract_facts(chunk, idx, len(chunks), user_id=user_id)
                if facts:
                    facts_parts.append(f"--- Partia {idx} ---\n{facts}")
        except Exception as e:
            job.status = "failed"
            job.error = f"Błąd ekstrakcji danych (LLM): {e}"
            job.finished_at = datetime.utcnow()
            db.commit()
            return

        if not facts_parts:
            job.status = "failed"
            job.error = "Model LLM nie wyekstrahował żadnych danych. Spróbuj ponownie."
            job.finished_at = datetime.utcnow()
            db.commit()
            return

        # Pass 2: generate final HTML report
        try:
            html = _generate_report("\n\n".join(facts_parts), len(emails), days_back, user_id=user_id)
        except Exception as e:
            job.status = "failed"
            job.error = f"Błąd generowania raportu (LLM): {e}"
            job.finished_at = datetime.utcnow()
            db.commit()
            return

        if not html:
            job.status = "failed"
            job.error = "Model LLM zwrócił pusty raport. Spróbuj ponownie."
            job.finished_at = datetime.utcnow()
            db.commit()
            return

        job.status = "done"
        job.result_html = html
        job.email_count = len(emails)
        job.finished_at = datetime.utcnow()
        db.commit()

    except Exception as e:
        logger.exception("inbox_runner unexpected error job_id=%s: %s", job_id, e)
        try:
            job = db.query(InboxReportJob).filter(InboxReportJob.id == job_id).first()
            if job:
                job.status = "failed"
                job.error = str(e)
                job.finished_at = datetime.utcnow()
                db.commit()
        except Exception:
            pass
    finally:
        db.close()
