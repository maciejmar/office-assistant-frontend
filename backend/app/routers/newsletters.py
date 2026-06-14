import json
import logging
import smtplib
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

from ..deps import get_db, get_current_user
from ..models import Newsletter, NewsletterJob, SendLog, User
from ..schemas import NewsletterOut, NewsletterDetailOut, NewsletterSendOut
from ..config import settings

router = APIRouter(prefix="/newsletters", tags=["newsletters"])


@router.get("", response_model=list[NewsletterOut])
def list_newsletters(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = (
        db.query(Newsletter)
        .join(NewsletterJob, Newsletter.job_id == NewsletterJob.id)
        .filter(NewsletterJob.user_id == user.id)
        .order_by(Newsletter.created_at.desc())
        .all()
    )
    return [
        NewsletterOut(
            id=n.id,
            subject=n.subject,
            created_at=n.created_at.isoformat() if n.created_at else "",
        )
        for n in rows
    ]


@router.get("/{newsletter_id}", response_model=NewsletterDetailOut)
def get_newsletter(newsletter_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    row = (
        db.query(Newsletter)
        .join(NewsletterJob, Newsletter.job_id == NewsletterJob.id)
        .filter(Newsletter.id == newsletter_id, NewsletterJob.user_id == user.id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Newsletter not found")
    job = db.query(NewsletterJob).filter(NewsletterJob.id == row.job_id).first()
    subscriber_count = 0
    if job and job.subscriber_emails:
        try:
            subscriber_count = len(json.loads(job.subscriber_emails))
        except Exception:
            pass
    return NewsletterDetailOut(
        id=row.id,
        subject=row.subject,
        html_body=row.html_body,
        text_body=row.text_body,
        created_at=row.created_at.isoformat() if row.created_at else "",
        pending_subscriber_count=subscriber_count,
    )


@router.post("/{newsletter_id}/send", response_model=NewsletterSendOut)
def send_newsletter(newsletter_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    row = (
        db.query(Newsletter)
        .join(NewsletterJob, Newsletter.job_id == NewsletterJob.id)
        .filter(Newsletter.id == newsletter_id, NewsletterJob.user_id == user.id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Newsletter not found")

    job = db.query(NewsletterJob).filter(NewsletterJob.id == row.job_id).first()
    subscriber_emails: list[str] = []
    if job and job.subscriber_emails:
        try:
            subscriber_emails = json.loads(job.subscriber_emails)
        except Exception:
            pass

    if not subscriber_emails:
        raise HTTPException(status_code=400, detail="Brak subskrybentów przypisanych do tego newslettera.")

    failed: list[str] = []
    for addr in subscriber_emails:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = row.subject
            msg["From"] = settings.smtp_from
            msg["To"] = addr
            msg.attach(MIMEText(row.text_body, "plain", "utf-8"))
            msg.attach(MIMEText(row.html_body, "html", "utf-8"))
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as s:
                s.sendmail(settings.smtp_from, addr, msg.as_string())
            status = "sent"
        except Exception as e:
            status = "failed"
            failed.append(addr)
            logger.error("SMTP send to %s failed: %s", addr, e)

        db.add(SendLog(
            newsletter_id=row.id,
            subscriber_email=addr,
            status=status,
            sent_at=datetime.utcnow(),
        ))

    db.commit()

    if failed and len(failed) == len(subscriber_emails):
        raise HTTPException(
            status_code=500,
            detail=f"Wysyłka nie powiodła się (SMTP: {settings.smtp_host}:{settings.smtp_port}). Sprawdź logi backendu."
        )

    return NewsletterSendOut(sent_count=len(subscriber_emails) - len(failed))
