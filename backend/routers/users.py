from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as ORM
from sqlalchemy.exc import IntegrityError
from ..database import get_db
from ..models import User, Session, Notification
from ..schemas import UserOut, UpdateProfileIn, ChangePasswordIn
from ..security import hash_password, verify_password
from ..dependencies import get_current_user, require_csrf

router = APIRouter(prefix="/api/user", tags=["user"])


@router.get("/profile")
def profile(user: User = Depends(get_current_user)):
    return {"success": True, "user": UserOut.model_validate(user).model_dump(mode="json")}


@router.put("/profile", dependencies=[Depends(require_csrf)])
def update_profile(payload: UpdateProfileIn, user: User = Depends(get_current_user), db: ORM = Depends(get_db)):
    if payload.full_name is not None:
        user.full_name = payload.full_name.strip()
    if payload.username is not None and payload.username != user.username:
        exists = db.query(User).filter(User.username == payload.username, User.id != user.id).first()
        if exists:
            raise HTTPException(status_code=409, detail="Username taken")
        user.username = payload.username
    db.add(Notification(user_id=user.id, title="Profile Updated", message="Your profile has been updated."))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Username taken")
    db.refresh(user)
    return {"success": True, "user": UserOut.model_validate(user).model_dump(mode="json")}


@router.put("/password", dependencies=[Depends(require_csrf)])
def change_password(payload: ChangePasswordIn, user: User = Depends(get_current_user), db: ORM = Depends(get_db)):
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password incorrect")
    user.password_hash = hash_password(payload.new_password)
    db.add(Notification(user_id=user.id, title="Password Changed", message="Your password was changed successfully."))
    db.commit()
    return {"success": True}


@router.delete("/account", dependencies=[Depends(require_csrf)])
def delete_account(user: User = Depends(get_current_user), db: ORM = Depends(get_db)):
    db.delete(user)
    db.commit()
    return {"success": True}


@router.get("/notifications")
def list_notifications(user: User = Depends(get_current_user), db: ORM = Depends(get_db)):
    from ..models import Notification as N
    rows = db.query(N).filter(N.user_id == user.id).order_by(N.created_at.desc()).limit(20).all()
    return {"success": True, "notifications": [
        {"id": str(r.id), "title": r.title, "message": r.message,
         "is_read": r.is_read, "created_at": r.created_at.isoformat()} for r in rows
    ]}


@router.post("/notifications/read-all", dependencies=[Depends(require_csrf)])
def mark_all_read(user: User = Depends(get_current_user), db: ORM = Depends(get_db)):
    db.query(Notification).filter(Notification.user_id == user.id).update({"is_read": True})
    db.commit()
    return {"success": True}


@router.get("/sessions")
def list_sessions(user: User = Depends(get_current_user), db: ORM = Depends(get_db)):
    rows = db.query(Session).filter(Session.user_id == user.id).all()
    return {"success": True, "sessions": [
        {"id": str(r.id), "created_at": r.created_at.isoformat(),
         "last_activity": r.last_activity.isoformat() if r.last_activity else None,
         "expires_at": r.expires_at.isoformat()} for r in rows
    ]}


@router.post("/sessions/logout-all", dependencies=[Depends(require_csrf)])
def logout_all(user: User = Depends(get_current_user), db: ORM = Depends(get_db)):
    db.query(Session).filter(Session.user_id == user.id).delete()
    db.commit()
    return {"success": True}