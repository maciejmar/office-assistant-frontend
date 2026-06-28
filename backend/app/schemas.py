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


class ForgotPasswordIn(BaseModel):
    email: EmailStr


class ResetPasswordIn(BaseModel):
    token: str
    password: str


class MeOut(BaseModel):
    id: int
    email: EmailStr
    role: str


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
    imap_host: Optional[str] = None
    imap_port: int = 993


class SmtpConfigOut(BaseModel):
    host: str
    port: int
    tls: bool
    username: str
    from_addr: str
    imap_host: Optional[str] = None
    imap_port: int = 993
    configured: bool = True


class InboxJobCreate(BaseModel):
    days_back: int = 60
    max_emails: int = 15
    imap_host: Optional[str] = None
    imap_port: int = 993
    username: Optional[str] = None
    password: Optional[str] = None


class InboxJobCreateOut(BaseModel):
    jobId: int


class InboxJobStatusOut(BaseModel):
    status: str
    result_html: Optional[str] = None
    email_count: int = 0
    error: Optional[str] = None


class UsageSummaryOut(BaseModel):
    total_cost_usd: float
    month_cost_usd: float
    total_calls: int
    by_operation: dict


class UsageHistoryItemOut(BaseModel):
    id: int
    operation: str
    model: str
    input_tokens: int
    output_tokens: int
    cost_usd: float
    created_at: str


class UsageAdminUserOut(BaseModel):
    user_id: int
    email: str
    total_cost_usd: float
    total_calls: int


class JobCreate(BaseModel):
    fileIds: List[int]
    subscriberEmails: List[EmailStr]
    language: str
    tone: str
    maxLength: int
    customPrompt: Optional[str] = None


class JobCreateOut(BaseModel):
    jobId: int


class JobStatusOut(BaseModel):
    status: str
    newsletterId: Optional[int] = None
    progress: Optional[int] = None
    error: Optional[str] = None
