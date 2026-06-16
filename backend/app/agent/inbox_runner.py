import logging
import re
from datetime import datetime

import httpx

from ..config import settings
from ..db import SessionLocal
from ..imap_reader import fetch_financial_emails
from ..models import InboxReportJob, UserSmtpConfig

logger = logging.getLogger(__name__)


def run_inbox_report(job_id: int, user_id: int, days_back: int, max_emails: int) -> None:
    db = SessionLocal()
    try:
        job = db.query(InboxReportJob).filter(InboxReportJob.id == job_id).first()
        if not job:
            return
        job.status = "running"
        db.commit()

        cfg = db.query(UserSmtpConfig).filter(UserSmtpConfig.user_id == user_id).first()
        if not cfg or not cfg.imap_host:
            job.status = "failed"
            job.error = "Brak konfiguracji IMAP. Uzupełnij serwer IMAP w Ustawieniach."
            job.finished_at = datetime.utcnow()
            db.commit()
            return

        try:
            emails = fetch_financial_emails(
                imap_host=cfg.imap_host,
                imap_port=cfg.imap_port or 993,
                username=cfg.username,
                password=cfg.password,
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

        emails_text = "\n\n".join(
            f"--- [{i+1}] ---\nData: {e.date}\nOd: {e.sender}\nTemat: {e.subject}\nTreść:\n{e.snippet}"
            for i, e in enumerate(emails)
        )

        prompt = f"""Jesteś asystentem finansowym. Przeanalizuj poniższe wiadomości e-mail z skrzynki użytkownika i przygotuj czytelny raport finansowy.

WIADOMOŚCI E-MAIL ({len(emails)} szt., ostatnie {days_back} dni):
{emails_text}

ZADANIE:
Stwórz przejrzysty raport HTML zawierający:
1. Podsumowanie — ile wiadomości finansowych, ogólny obraz sytuacji
2. Płatności i przelewy — lista z datami, kwotami (jeśli widoczne), nadawcą/odbiorcą
3. Faktury i rachunki — lista wystawionych lub otrzymanych
4. Składki i podatki (ZUS, US, VAT, PIT) — osobna sekcja jeśli występują
5. Uwagi — nieodebrane, zaległe lub ważne nadchodzące płatności

ZASADY:
- Używaj WYŁĄCZNIE informacji z dostarczonych e-maili
- NIE WYMYŚLAJ kwot, dat ani nazw których nie ma w treści
- Jeśli czegoś nie możesz ustalić, napisz "brak danych"
- Odpowiedz tylko fragmentem HTML (bez <html>/<head>/<body>) używając: <h2>, <h3>, <p>, <ul>, <li>, <table>, <strong>
- Pisz po polsku"""

        try:
            with httpx.Client(timeout=300) as client:
                resp = client.post(
                    f"{settings.ollama_url}/api/generate",
                    json={"model": settings.ollama_model, "prompt": prompt, "stream": False},
                )
                resp.raise_for_status()
                raw = resp.json().get("response", "")
        except Exception as e:
            job.status = "failed"
            job.error = f"Błąd LLM: {e}"
            job.finished_at = datetime.utcnow()
            db.commit()
            return

        html = re.sub(r"^```[a-zA-Z]*\n?", "", raw.strip())
        html = re.sub(r"\n?```$", "", html.strip()).strip()

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
