from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as ORM
from uuid import UUID
from ..database import get_db
from ..models import User, ApiKey, Notification
from ..schemas import ApiKeyCreateIn, ApiKeyRenameIn, ApiKeyOut, ApiKeyCreatedOut
from ..security import generate_api_key
from ..dependencies import get_current_user, require_csrf

router = APIRouter(prefix="/api/keys", tags=["api-keys"])


@router.get("")
def list_keys(user: User = Depends(get_current_user), db: ORM = Depends(get_db)):
    rows = db.query(ApiKey).filter(ApiKey.user_id == user.id).order_by(ApiKey.created_at.desc()).all()
    return {"success": True, "keys": [ApiKeyOut.model_validate(r).model_dump(mode="json") for r in rows]}


@router.post("", dependencies=[Depends(require_csrf)])
def create_key(payload: ApiKeyCreateIn, user: User = Depends(get_current_user), db: ORM = Depends(get_db)):
    count = db.query(ApiKey).filter(ApiKey.user_id == user.id, ApiKey.status == "active").count()
    if count >= 10:
        raise HTTPException(status_code=400, detail="Maximum 10 active API keys allowed")

    full, prefix, key_hash = generate_api_key()
    key = ApiKey(user_id=user.id, name=payload.name.strip(), key_prefix=prefix, key_hash=key_hash)
    db.add(key)
    db.add(Notification(user_id=user.id, title="API Key Generated", message=f"Key '{payload.name}' was created."))
    db.commit()
    db.refresh(key)
    out = ApiKeyOut.model_validate(key).model_dump(mode="json")
    out["key"] = full  # one-time reveal
    return {"success": True, "key": out}


@router.patch("/{key_id}", dependencies=[Depends(require_csrf)])
def rename_key(key_id: UUID, payload: ApiKeyRenameIn, user: User = Depends(get_current_user), db: ORM = Depends(get_db)):
    key = db.query(ApiKey).filter(ApiKey.id == key_id, ApiKey.user_id == user.id).first()
    if not key:
        raise HTTPException(status_code=404, detail="Key not found")
    key.name = payload.name.strip()
    db.commit()
    db.refresh(key)
    return {"success": True, "key": ApiKeyOut.model_validate(key).model_dump(mode="json")}


@router.post("/{key_id}/revoke", dependencies=[Depends(require_csrf)])
def revoke_key(key_id: UUID, user: User = Depends(get_current_user), db: ORM = Depends(get_db)):
    from ..security import utcnow
    key = db.query(ApiKey).filter(ApiKey.id == key_id, ApiKey.user_id == user.id).first()
    if not key:
        raise HTTPException(status_code=404, detail="Key not found")
    if key.status == "revoked":
        raise HTTPException(status_code=400, detail="Already revoked")
    key.status = "revoked"
    key.revoked_at = utcnow()
    db.add(Notification(user_id=user.id, title="API Key Revoked", message=f"Key '{key.name}' was revoked."))
    db.commit()
    db.refresh(key)
    return {"success": True, "key": ApiKeyOut.model_validate(key).model_dump(mode="json")}


@router.delete("/{key_id}", dependencies=[Depends(require_csrf)])
def delete_key(key_id: UUID, user: User = Depends(get_current_user), db: ORM = Depends(get_db)):
    key = db.query(ApiKey).filter(ApiKey.id == key_id, ApiKey.user_id == user.id).first()
    if not key:
        raise HTTPException(status_code=404, detail="Key not found")
    db.delete(key)
    db.commit()
    return {"success": True}