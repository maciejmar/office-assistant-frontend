from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..deps import get_db, get_current_user
from ..models import Subscriber, User
from ..schemas import SubscriberOut, SubscriberCreate, SubscriberImport

router = APIRouter(prefix="/subscribers", tags=["subscribers"])


@router.get("", response_model=list[SubscriberOut])
def list_subscribers(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    items = db.query(Subscriber).filter(Subscriber.user_id == user.id).all()
    return [
        SubscriberOut(
            id=s.id,
            email=s.email,
            status=s.status,
            created_at=s.created_at.isoformat() if s.created_at else None,
        )
        for s in items
    ]


@router.post("", response_model=SubscriberOut)
def add_subscriber(
    payload: SubscriberCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sub = Subscriber(user_id=user.id, email=payload.email)
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return SubscriberOut(
        id=sub.id,
        email=sub.email,
        status=sub.status,
        created_at=sub.created_at.isoformat() if sub.created_at else None,
    )


@router.delete("/{subscriber_id}")
def delete_subscriber(
    subscriber_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.query(Subscriber).filter(Subscriber.user_id == user.id, Subscriber.id == subscriber_id).delete()
    db.commit()
    return {"ok": True}


@router.post("/import")
def import_subscribers(
    payload: SubscriberImport,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    for email in payload.emails:
        sub = Subscriber(user_id=user.id, email=email)
        db.add(sub)
    db.commit()
    return {"ok": True, "count": len(payload.emails)}
