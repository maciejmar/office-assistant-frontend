from datetime import datetime
import httpx
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from ..deps import get_db, get_current_user
from ..models import NewsletterJob, Newsletter, User
from ..schemas import JobCreate, JobCreateOut, JobStatusOut
from ..config import settings

router = APIRouter(prefix="/newsletter/jobs", tags=["jobs"])


@router.post("", response_model=JobCreateOut)
def create_job(
    payload: JobCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    authorization: str | None = Header(default=None),
):
    job = NewsletterJob(user_id=user.id, status="queued", created_at=datetime.utcnow())
    db.add(job)
    db.commit()
    db.refresh(job)

    access_token = None
    if authorization and authorization.startswith("Bearer "):
        access_token = authorization.split(" ", 1)[1]

    webhook_payload = {
        "job_id": job.id,
        "user_id": user.id,
        "file_ids": payload.fileIds,
        "subscriber_emails": payload.subscriberEmails,
        "language": payload.language,
        "tone": payload.tone,
        "max_length": payload.maxLength,
        "subject_hint": "",
        "access_token": access_token,
    }

    try:
        with httpx.Client(timeout=20) as client:
            client.post(settings.n8n_webhook_url, json=webhook_payload)
    except Exception as exc:
        job.status = "failed"
        job.error = str(exc)
        db.add(job)
        db.commit()
        raise HTTPException(status_code=500, detail="Failed to trigger workflow")

    return JobCreateOut(jobId=job.id)


@router.get("/{job_id}", response_model=JobStatusOut)
def get_job(job_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    job = db.query(NewsletterJob).filter(NewsletterJob.id == job_id, NewsletterJob.user_id == user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    newsletter = db.query(Newsletter).filter(Newsletter.job_id == job.id).first()
    return JobStatusOut(
        status=job.status,
        newsletterId=newsletter.id if newsletter else None,
        error=job.error,
    )
