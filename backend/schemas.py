from pydantic import BaseModel, EmailStr, Field, field_validator
from datetime import datetime
from uuid import UUID
from typing import Optional


class RegisterIn(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=120)
    username: str = Field(..., min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_.]+$")
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    accept_terms: bool

    @field_validator("accept_terms")
    def must_accept(cls, v):
        if not v:
            raise ValueError("You must accept Terms & Conditions")
        return v


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class ForgotIn(BaseModel):
    email: EmailStr


class ResetIn(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8, max_length=128)


class UserOut(BaseModel):
    id: UUID
    full_name: str
    username: str
    email: EmailStr
    created_at: datetime

    class Config:
        from_attributes = True


class UpdateProfileIn(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=120)
    username: Optional[str] = Field(None, min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_.]+$")


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8, max_length=128)


class ApiKeyCreateIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)


class ApiKeyRenameIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)


class ApiKeyOut(BaseModel):
    id: UUID
    name: str
    key_prefix: str
    status: str
    created_at: datetime
    last_used_at: Optional[datetime]
    revoked_at: Optional[datetime]

    class Config:
        from_attributes = True


class ApiKeyCreatedOut(ApiKeyOut):
    key: str  # plaintext returned ONCE only


class NotificationOut(BaseModel):
    id: UUID
    title: str
    message: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True