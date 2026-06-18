from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..deps import get_db, get_current_user
from ..models import UsageLog
from ..schemas import UsageSummaryOut, UsageHistoryItemOut

router = APIRouter(prefix="/usage", tags=["usage"])


@router.get("/summary", response_model=UsageSummaryOut)
def get_usage_summary(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = db.query(UsageLog).filter(UsageLog.user_id == current_user.id).all()

    total_cost = sum(r.cost_usd for r in rows)
    total_calls = len(rows)

    now = datetime.utcnow()
    month_cost = sum(
        r.cost_usd for r in rows
        if r.created_at and r.created_at.year == now.year and r.created_at.month == now.month
    )

    by_op: dict[str, float] = {}
    for r in rows:
        by_op[r.operation] = round(by_op.get(r.operation, 0.0) + r.cost_usd, 6)

    return UsageSummaryOut(
        total_cost_usd=round(total_cost, 6),
        month_cost_usd=round(month_cost, 6),
        total_calls=total_calls,
        by_operation=by_op,
    )


@router.get("/history", response_model=List[UsageHistoryItemOut])
def get_usage_history(
    limit: int = 50,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(UsageLog)
        .filter(UsageLog.user_id == current_user.id)
        .order_by(UsageLog.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        UsageHistoryItemOut(
            id=r.id,
            operation=r.operation,
            model=r.model,
            input_tokens=r.input_tokens,
            output_tokens=r.output_tokens,
            cost_usd=r.cost_usd,
            created_at=r.created_at.isoformat() if r.created_at else "",
        )
        for r in rows
    ]
