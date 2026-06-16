import logging
import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..deps import get_db, get_current_user
from ..models import User, UserSmtpConfig
from ..schemas import InboxReportIn, InboxReportOut
from ..imap_reader import fetch_financial_emails
from ..config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/reports", tags=["reports"])


@router.post("/inbox", response_model=InboxReportOut)
def generate_inbox_report(
    payload: InboxReportIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cfg = db.query(UserSmtpConfig).filter(UserSmtpConfig.user_id == user.id).first()
    if not cfg or not cfg.imap_host:
        raise HTTPException(
            status_code=400,
            detail="Brak konfiguracji IMAP. Uzupełnij serwer IMAP w Ustawieniach.",
        )

    try:
        emails = fetch_financial_emails(
            imap_host=cfg.imap_host,
            imap_port=cfg.imap_port or 993,
            username=cfg.username,
            password=cfg.password,
            days_back=payload.days_back,
            max_emails=payload.max_emails,
        )
    except Exception as e:
        logger.error("IMAP fetch error: %s", e)
        raise HTTPException(status_code=400, detail=f"Błąd połączenia IMAP: {e}")

    if not emails:
        return InboxReportOut(
            html="<p>Nie znaleziono wiadomości dotyczących płatności i rachunków w podanym okresie.</p>",
            email_count=0,
        )

    emails_text = "\n\n".join(
        f"--- [{i+1}] ---\nData: {e.date}\nOd: {e.sender}\nTemat: {e.subject}\nTreść:\n{e.snippet}"
        for i, e in enumerate(emails)
    )

    prompt = f"""Jesteś asystentem finansowym. Przeanalizuj poniższe wiadomości e-mail z skrzynki użytkownika i przygotuj czytelny raport finansowy.

WIADOMOŚCI E-MAIL ({len(emails)} szt., ostatnie {payload.days_back} dni):
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
        raise HTTPException(status_code=500, detail=f"Błąd LLM: {e}")

    # strip any markdown fences
    import re
    html = re.sub(r"^```[a-zA-Z]*\n?", "", raw.strip())
    html = re.sub(r"\n?```$", "", html.strip()).strip()

    return InboxReportOut(html=html, email_count=len(emails))
