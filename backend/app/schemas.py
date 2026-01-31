from pydantic import BaseModel, EmailStr
from typing import List, Optional


class AuthRegister(BaseModel):
    email: EmailStr
    password: str


class AuthLogin(BaseModel):
    email: EmailStr
    password: str


class AuthToken(BaseModel):
    accessToken: str


class SubscriberOut(BaseModel):
    id: int
    email: EmailStr
    status: Optional[str] = None
    created_at: Optional[str] = None


class SubscriberCreate(BaseModel):
    email: EmailStr


class SubscriberImport(BaseModel):
    emails: List[EmailStr]


class FileOut(BaseModel):
    id: int
    filename: str
    status: str
    uploaded_at: Optional[str] = None


class FilePresignIn(BaseModel):
    filename: str
    mime: str
    size: int


class FilePresignOut(BaseModel):
    uploadUrl: str
    fileId: int


class NewsletterOut(BaseModel):
    id: int
    subject: str
    created_at: str


class NewsletterDetailOut(BaseModel):
    id: int
    subject: str
    html_body: str
    text_body: str
    created_at: str


class JobCreate(BaseModel):
    fileIds: List[int]
    subscriberEmails: List[EmailStr]
    language: str
    tone: str
    maxLength: int


class JobCreateOut(BaseModel):
    jobId: int


class JobStatusOut(BaseModel):
    status: str
    newsletterId: Optional[int] = None
    progress: Optional[int] = None
    error: Optional[str] = None
