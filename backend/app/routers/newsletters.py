import json
import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..deps import get_db, get_current_user
from ..models import Newsletter, NewsletterJob, User
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
        raise HTTPException(status_code=400, detail="No subscribers assigned to this newsletter.")

    if not settings.n8n_send_webhook_url:
        raise HTTPException(status_code=501, detail="Send webhook not configured (n8n_send_webhook_url).")

    payload = {
        "newsletter_id": row.id,
        "subject": row.subject,
        "html_body": row.html_body,
        "text_body": row.text_body,
        "subscriber_emails": subscriber_emails,
    }
    try:
        with httpx.Client(timeout=20) as client:
            resp = client.post(settings.n8n_send_webhook_url, json=payload)
            if resp.status_code >= 400:
                raise HTTPException(status_code=502, detail=f"Send workflow failed: {resp.status_code}")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to trigger send workflow: {exc}")

    return NewsletterSendOut(sent_count=len(subscriber_emails))
