from datetime import datetime
from sqlalchemy import String, Integer, DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .db import Base


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    refresh_token_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Subscriber(Base):
    __tablename__ = "subscribers"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"))
    email: Mapped[str] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(32), default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class File(Base):
    __tablename__ = "files"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"))
    filename: Mapped[str] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(32), default="pending")
    uploaded_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    storage_key: Mapped[str] = mapped_column(String(255))
    mime: Mapped[str] = mapped_column(String(128), default="application/octet-stream")
    size: Mapped[int] = mapped_column(Integer, default=0)


class NewsletterJob(Base):
    __tablename__ = "newsletter_jobs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(String(32), default="queued")
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Newsletter(Base):
    __tablename__ = "newsletters"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    job_id: Mapped[int] = mapped_column(Integer, ForeignKey("newsletter_jobs.id"))
    subject: Mapped[str] = mapped_column(String(255))
    html_body: Mapped[str] = mapped_column(Text)
    text_body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class SendLog(Base):
    __tablename__ = "send_log"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    newsletter_id: Mapped[int] = mapped_column(Integer, ForeignKey("newsletters.id"))
    subscriber_email: Mapped[str] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(32))
    sent_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
