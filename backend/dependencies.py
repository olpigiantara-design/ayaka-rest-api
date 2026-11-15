from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session as ORM
from datetime import datetime, timezone
from .database import get_db
from .models import User, Session, ApiKey
from .security import COOKIE_NAME, CSRF_COOKIE, hash_token, hash_api_key


def get_current_user(request: Request, db: ORM = Depends(get_db)) -> User:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    token_hash = hash_token(token)
    session = db.query(Session).filter(Session.session_token_hash == token_hash).first()
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    now = datetime.now(timezone.utc)
    exp = session.expires_at.replace(tzinfo=timezone.utc) if session.expires_at.tzinfo is None else session.expires_at
    if exp < now:
        db.delete(session)
        db.commit()
        raise HTTPException(status_code=401, detail="Session expired")
    user = db.query(User).filter(User.id == session.user_id, User.is_active.is_(True)).first()
    if not user:
        raise HTTPException(status_code=401, detail="User inactive")

    # Sliding window: extend if > 1 hour since last activity
    last = session.last_activity
    if last and last.tzinfo is None:
        last = last.replace(tzinfo=timezone.utc)
    if not last or (now - last) > timedelta_safe(hours=1):
        session.last_activity = now
        session.expires_at = now + timedelta_safe(hours=int(__import__("os").environ.get("SESSION_EXPIRE_HOURS", "168")))
        db.commit()
    return user


def timedelta_safe(**kw):
    from datetime import timedelta
    return timedelta(**kw)


def require_csrf(request: Request):
    """Double-submit CSRF check for state-changing requests."""
    if request.method in ("GET", "HEAD", "OPTIONS"):
        return
    cookie = request.cookies.get(CSRF_COOKIE)
    header = request.headers.get("x-csrf-token")
    if not cookie or not header or cookie != header:
        raise HTTPException(status_code=403, detail="CSRF validation failed")


def get_api_key_owner(request: Request, db: ORM = Depends(get_db)) -> tuple[User, ApiKey]:
    """Validate X-API-Key header, return (user, key)."""
    raw = request.headers.get("x-api-key")
    if not raw:
        raise HTTPException(status_code=401, detail="Missing X-API-Key header")
    key_hash = hash_api_key(raw)
    record = db.query(ApiKey).filter(ApiKey.key_hash == key_hash).first()
    if not record:
        raise HTTPException(status_code=401, detail="Invalid API Key")
    if record.status != "active":
        raise HTTPException(status_code=403, detail="API Key revoked")
    user = db.query(User).filter(User.id == record.user_id, User.is_active.is_(True)).first()
    if not user:
        raise HTTPException(status_code=403, detail="Owner inactive")
    return user, record