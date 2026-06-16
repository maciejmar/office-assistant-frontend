from datetime import datetime
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from ..deps import get_db, get_current_user
from ..models import User, InboxReportJob
from ..schemas import InboxJobCreate, InboxJobCreateOut, InboxJobStatusOut
from ..agent.inbox_runner import run_inbox_report

router = APIRouter(prefix="/reports", tags=["reports"])


@router.post("/inbox", response_model=InboxJobCreateOut)
def start_inbox_report(
    payload: InboxJobCreate,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    job = InboxReportJob(
        user_id=user.id,
        status="queued",
        days_back=payload.days_back,
        max_emails=payload.max_emails,
        created_at=datetime.utcnow(),
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    background_tasks.add_task(
        run_inbox_report,
        job_id=job.id,
        user_id=user.id,
        days_back=payload.days_back,
        max_emails=payload.max_emails,
    )

    return InboxJobCreateOut(jobId=job.id)


@router.get("/inbox/{job_id}", response_model=InboxJobStatusOut)
def get_inbox_report(
    job_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    job = db.query(InboxReportJob).filter(
        InboxReportJob.id == job_id,
        InboxReportJob.user_id == user.id,
    ).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return InboxJobStatusOut(
        status=job.status,
        result_html=job.result_html,
        email_count=job.email_count or 0,
        error=job.error,
    )
