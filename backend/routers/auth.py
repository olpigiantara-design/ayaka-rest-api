from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session as ORM
from sqlalchemy.exc import IntegrityError
from datetime import datetime, timezone, timedelta
import secrets
from ..database import get_db
from ..models import User, Session, PasswordResetToken, Notification
from ..schemas import RegisterIn, LoginIn, ForgotIn, ResetIn, UserOut
from ..security import (
    hash_password, verify_password, generate_session_token, hash_token,
    COOKIE_NAME, CSRF_COOKIE, generate_csrf_token, SESSION_EXPIRE_HOURS, utcnow,
)
from ..dependencies import get_current_user, require_csrf

router = APIRouter(prefix="/api/auth", tags=["auth"])

IS_PROD = True  # set True on Vercel


def _set_session_cookies(response: Response, token: str):
    max_age = SESSION_EXPIRE_HOURS * 3600
    response.set_cookie(
        COOKIE_NAME, token, max_age=max_age, httponly=True,
        secure=IS_PROD, samesite="lax", path="/",
    )
    response.set_cookie(
        CSRF_COOKIE, generate_csrf_token(), max_age=max_age,
        httponly=False, secure=IS_PROD, samesite="lax", path="/",
    )


@router.post("/register")
def register(payload: RegisterIn, response: Response, db: ORM = Depends(get_db)):
    existing = db.query(User).filter(
        (User.email == payload.email.lower()) | (User.username == payload.username)
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Email or username already registered")

    user = User(
        full_name=payload.full_name.strip(),
        username=payload.username.strip(),
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Email or username already registered")
    db.refresh(user)

    # auto-login
    token = generate_session_token()
    sess = Session(
        user_id=user.id,
        session_token_hash=hash_token(token),
        expires_at=utcnow() + timedelta(hours=SESSION_EXPIRE_HOURS),
    )
    db.add(sess)
    db.add(Notification(user_id=user.id, title="Welcome to AYAKA", message="Your account has been created successfully."))
    db.commit()
    _set_session_cookies(response, token)
    return {"success": True, "user": UserOut.model_validate(user).model_dump(mode="json")}


@router.post("/login")
def login(payload: LoginIn, response: Response, db: ORM = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")

    token = generate_session_token()
    sess = Session(
        user_id=user.id,
        session_token_hash=hash_token(token),
        expires_at=utcnow() + timedelta(hours=SESSION_EXPIRE_HOURS),
    )
    db.add(sess)
    db.add(Notification(user_id=user.id, title="Login Successful", message="You logged in from a new session."))
    db.commit()
    _set_session_cookies(response, token)
    return {"success": True, "user": UserOut.model_validate(user).model_dump(mode="json")}


@router.post("/logout")
def logout(request: Request, response: Response, db: ORM = Depends(get_db), _=Depends(require_csrf)):
    token = request.cookies.get(COOKIE_NAME)
    if token:
        db.query(Session).filter(Session.session_token_hash == hash_token(token)).delete()
        db.commit()
    response.delete_cookie(COOKIE_NAME, path="/")
    response.delete_cookie(CSRF_COOKIE, path="/")
    return {"success": True}


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return {"success": True, "user": UserOut.model_validate(user).model_dump(mode="json")}


@router.post("/refresh")
def refresh(request: Request, response: Response, db: ORM = Depends(get_db), _=Depends(require_csrf)):
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    sess = db.query(Session).filter(Session.session_token_hash == hash_token(token)).first()
    if not sess:
        raise HTTPException(status_code=401, detail="Invalid session")
    # Rotate
    db.delete(sess)
    new_token = generate_session_token()
    db.add(Session(
        user_id=sess.user_id,
        session_token_hash=hash_token(new_token),
        expires_at=utcnow() + timedelta(hours=SESSION_EXPIRE_HOURS),
    ))
    db.commit()
    _set_session_cookies(response, new_token)
    return {"success": True}


@router.post("/forgot-password")
def forgot_password(payload: ForgotIn, db: ORM = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    # Always return success (no email enumeration)
    if user:
        raw = secrets.token_urlsafe(48)
        db.add(PasswordResetToken(
            user_id=user.id,
            token_hash=hash_token(raw, secret=__import__("os").environ.get("SECRET_KEY", "dev")),
            expires_at=utcnow() + timedelta(hours=1),
        ))
        db.commit()
        # In production: send raw token via email using RESEND_API_KEY.
        # For now, we log-safe return it only in dev.
    return {"success": True, "message": "If the email exists, a reset link has been sent."}


@router.post("/reset-password")
def reset_password(payload: ResetIn, db: ORM = Depends(get_db)):
    import os
    secret = os.environ.get("SECRET_KEY", "dev")
    tok_hash = hash_token(payload.token, secret=secret)
    rec = db.query(PasswordResetToken).filter(PasswordResetToken.token_hash == tok_hash).first()
    if not rec or rec.used_at is not None:
        raise HTTPException(status_code=400, detail="Invalid or used token")
    exp = rec.expires_at if rec.expires_at.tzinfo else rec.expires_at.replace(tzinfo=timezone.utc)
    if exp < utcnow():
        raise HTTPException(status_code=400, detail="Token expired")
    user = db.query(User).filter(User.id == rec.user_id).first()
    if not user:
        raise HTTPException(status_code=400, detail="User not found")
    user.password_hash = hash_password(payload.new_password)
    rec.used_at = utcnow()
    db.query(Session).filter(Session.user_id == user.id).delete()
    db.commit()
    return {"success": True, "message": "Password reset. Please log in."}