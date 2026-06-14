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
    mime: Optional[str] = None
    size: Optional[int] = None


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
    pending_subscriber_count: int = 0


class NewsletterSendOut(BaseModel):
    sent_count: int


class SmtpConfigIn(BaseModel):
    host: str
    port: int = 587
    tls: bool = True
    username: str
    password: str
    from_addr: str


class SmtpConfigOut(BaseModel):
    host: str
    port: int
    tls: bool
    username: str
    from_addr: str
    configured: bool = True


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
