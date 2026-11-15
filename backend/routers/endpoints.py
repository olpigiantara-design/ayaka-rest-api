from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy.orm import Session as ORM
from datetime import datetime, timezone, timedelta
import time
from ..database import get_db
from ..models import User, ApiKey, ApiLog
from ..dependencies import get_api_key_owner
from ..security import utcnow

router = APIRouter(prefix="/api/v1", tags=["public-api"])

RATE_LIMIT_PER_MIN = 60


def _enforce_rate_limit(key: ApiKey, db: ORM):
    since = utcnow() - timedelta(minutes=1)
    n = db.query(ApiLog).filter(
        ApiLog.api_key_id == key.id, ApiLog.created_at >= since
    ).count()
    if n >= RATE_LIMIT_PER_MIN:
        raise HTTPException(status_code=429, detail=f"Rate limit exceeded ({RATE_LIMIT_PER_MIN}/min)")


def _log(db: ORM, user: User, key: ApiKey, endpoint: str, method: str, status: int, ms: int):
    key.last_used_at = utcnow()
    db.add(ApiLog(
        user_id=user.id, api_key_id=key.id, endpoint=endpoint,
        method=method, status_code=status, response_time=ms,
    ))
    db.commit()


@router.get("/example")
def example(request: Request, ctx=Depends(get_api_key_owner), db: ORM = Depends(get_db)):
    user, key = ctx
    t0 = time.time()
    try:
        _enforce_rate_limit(key, db)
        payload = {
            "success": True,
            "creator": "Ayaka REST API",
            "message": "API connected successfully",
            "data": {
                "status": "online",
                "user": user.username,
                "timestamp": utcnow().isoformat(),
            },
        }
        _log(db, user, key, "/api/v1/example", "GET", 200, int((time.time() - t0) * 1000))
        return payload
    except HTTPException as e:
        _log(db, user, key, "/api/v1/example", "GET", e.status_code, int((time.time() - t0) * 1000))
        raise


@router.get("/user")
def user_info(ctx=Depends(get_api_key_owner), db: ORM = Depends(get_db)):
    user, key = ctx
    t0 = time.time()
    _enforce_rate_limit(key, db)
    data = {
        "success": True,
        "data": {
            "username": user.username,
            "full_name": user.full_name,
            "joined": user.created_at.isoformat() if user.created_at else None,
        },
    }
    _log(db, user, key, "/api/v1/user", "GET", 200, int((time.time() - t0) * 1000))
    return data


@router.get("/keys/info")
def key_info(ctx=Depends(get_api_key_owner), db: ORM = Depends(get_db)):
    user, key = ctx
    t0 = time.time()
    _enforce_rate_limit(key, db)
    data = {
        "success": True,
        "data": {
            "key_name": key.name,
            "key_prefix": key.key_prefix,
            "status": key.status,
            "created_at": key.created_at.isoformat(),
        },
    }
    _log(db, user, key, "/api/v1/keys/info", "GET", 200, int((time.time() - t0) * 1000))
    return data