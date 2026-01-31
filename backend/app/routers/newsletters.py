from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..deps import get_db, get_current_user
from ..models import Newsletter, NewsletterJob, User
from ..schemas import NewsletterOut, NewsletterDetailOut

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
    return NewsletterDetailOut(
        id=row.id,
        subject=row.subject,
        html_body=row.html_body,
        text_body=row.text_body,
        created_at=row.created_at.isoformat() if row.created_at else "",
    )
