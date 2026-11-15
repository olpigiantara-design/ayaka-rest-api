import os
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError

ph = PasswordHasher(time_cost=2, memory_cost=65536, parallelism=2, hash_len=32, salt_len=16)

SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-change-me")
SESSION_SECRET = os.environ.get("SESSION_SECRET", "dev-session-change-me")
SESSION_EXPIRE_HOURS = int(os.environ.get("SESSION_EXPIRE_HOURS", "168"))

COOKIE_NAME = "ayaka_session"
CSRF_COOKIE = "ayaka_csrf"


def hash_password(password: str) -> str:
    return ph.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    try:
        return ph.verify(hashed, password)
    except (VerifyMismatchError, VerificationError, Exception):
        return False


def hash_token(token: str, secret: str = SESSION_SECRET) -> str:
    return hmac.new(secret.encode(), token.encode(), hashlib.sha256).hexdigest()


def generate_session_token() -> str:
    return secrets.token_urlsafe(48)


def generate_csrf_token() -> str:
    return secrets.token_urlsafe(32)


def generate_api_key() -> tuple[str, str, str]:
    """Return (full_key, prefix, hash). Full key only shown once."""
    body = secrets.token_urlsafe(32).replace("-", "").replace("_", "")[:40]
    full = f"ayaka_live_{body}"
    prefix = full[:18]  # ayaka_live_XXXXXXX
    key_hash = hashlib.sha256(full.encode()).hexdigest()
    return full, prefix, key_hash


def hash_api_key(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()


def utcnow() -> datetime:
    return datetime.now(timezone.utc)