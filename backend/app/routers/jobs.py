from datetime import datetime
import json
import httpx
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from ..deps import get_db, get_current_user
from ..models import NewsletterJob, Newsletter, User, File
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
    selected_files = (
        db.query(File)
        .filter(File.user_id == user.id, File.id.in_(payload.fileIds), File.status.in_(["uploaded", "ready"]))
        .all()
    )
    if len(selected_files) != len(payload.fileIds):
        raise HTTPException(status_code=400, detail="Some selected files are missing or not ready.")

    total_bytes = sum((f.size or 0) for f in selected_files)
    max_bytes = settings.max_job_total_input_mb * 1024 * 1024
    if total_bytes > max_bytes:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Selected files are too large for generation ({round(total_bytes / (1024 * 1024), 1)} MB). "
                f"Limit is {settings.max_job_total_input_mb} MB. Remove some old/large PDFs."
            ),
        )

    job = NewsletterJob(
        user_id=user.id,
        status="queued",
        created_at=datetime.utcnow(),
        subscriber_emails=json.dumps([str(e) for e in payload.subscriberEmails]),
    )
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
            resp = client.post(settings.n8n_webhook_url, json=webhook_payload)
            if resp.status_code >= 400:
                job.status = "failed"
                job.error = f"Workflow trigger failed: {resp.status_code} {resp.text[:300]}"
                db.add(job)
                db.commit()
                raise HTTPException(status_code=502, detail="Workflow trigger returned error")
    except HTTPException:
        raise
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
