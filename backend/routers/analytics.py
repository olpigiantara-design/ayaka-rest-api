from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session as ORM
from sqlalchemy import func, cast, Date
from datetime import datetime, timedelta, timezone
from ..database import get_db
from ..models import User, ApiKey, ApiLog
from ..dependencies import get_current_user

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/overview")
def overview(user: User = Depends(get_current_user), db: ORM = Depends(get_db)):
    total_keys = db.query(ApiKey).filter(ApiKey.user_id == user.id, ApiKey.status == "active").count()
    total_requests = db.query(ApiLog).filter(ApiLog.user_id == user.id).count()
    successful = db.query(ApiLog).filter(ApiLog.user_id == user.id, ApiLog.status_code < 400).count()
    failed = total_requests - successful
    return {
        "success": True,
        "stats": {
            "total_keys": total_keys,
            "total_requests": total_requests,
            "successful_requests": successful,
            "failed_requests": failed,
        },
    }


@router.get("/requests")
def requests_series(
    range: str = Query("7d", pattern="^(today|7d|30d|all)$"),
    user: User = Depends(get_current_user),
    db: ORM = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    if range == "today":
        start = now - timedelta(days=1)
    elif range == "7d":
        start = now - timedelta(days=7)
    elif range == "30d":
        start = now - timedelta(days=30)
    else:
        start = now - timedelta(days=365)

    rows = (
        db.query(cast(ApiLog.created_at, Date).label("d"), func.count().label("c"))
        .filter(ApiLog.user_id == user.id, ApiLog.created_at >= start)
        .group_by(cast(ApiLog.created_at, Date))
        .order_by(cast(ApiLog.created_at, Date))
        .all()
    )
    return {
        "success": True,
        "range": range,
        "series": [{"date": str(r.d), "count": r.c} for r in rows],
    }


@router.get("/endpoints")
def endpoints_stats(
    range: str = Query("7d", pattern="^(today|7d|30d|all)$"),
    user: User = Depends(get_current_user),
    db: ORM = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    if range == "today":
        start = now - timedelta(days=1)
    elif range == "7d":
        start = now - timedelta(days=7)
    elif range == "30d":
        start = now - timedelta(days=30)
    else:
        start = now - timedelta(days=365)

    rows = (
        db.query(ApiLog.endpoint, func.count().label("c"),
                 func.avg(ApiLog.response_time).label("avg"))
        .filter(ApiLog.user_id == user.id, ApiLog.created_at >= start)
        .group_by(ApiLog.endpoint)
        .order_by(func.count().desc())
        .limit(10)
        .all()
    )
    return {
        "success": True,
        "endpoints": [{"endpoint": r.endpoint, "count": r.c, "avg_ms": round(float(r.avg or 0), 2)} for r in rows],
    }


@router.get("/activity")
def recent_activity(user: User = Depends(get_current_user), db: ORM = Depends(get_db)):
    rows = (
        db.query(ApiLog).filter(ApiLog.user_id == user.id)
        .order_by(ApiLog.created_at.desc()).limit(15).all()
    )
    return {"success": True, "logs": [
        {"id": str(r.id), "method": r.method, "endpoint": r.endpoint,
         "status_code": r.status_code, "response_time": r.response_time,
         "created_at": r.created_at.isoformat()} for r in rows
    ]}