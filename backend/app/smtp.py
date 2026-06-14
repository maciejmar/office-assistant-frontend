import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from dataclasses import dataclass

from .config import settings


@dataclass
class SmtpCreds:
    host: str
    port: int
    tls: bool
    username: str
    password: str
    from_addr: str


def default_creds() -> SmtpCreds:
    return SmtpCreds(
        host=settings.smtp_host,
        port=settings.smtp_port,
        tls=settings.smtp_tls,
        username=settings.smtp_user,
        password=settings.smtp_password,
        from_addr=settings.smtp_from,
    )


def send_email(to: str, subject: str, html: str, text: str, creds: SmtpCreds | None = None) -> None:
    c = creds or default_creds()
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = c.from_addr
    msg["To"] = to
    msg.attach(MIMEText(text, "plain", "utf-8"))
    msg.attach(MIMEText(html, "html", "utf-8"))

    with smtplib.SMTP(c.host, c.port) as s:
        s.ehlo()
        if c.tls:
            s.starttls()
            s.ehlo()
        if c.username and c.password:
            s.login(c.username, c.password)
        s.sendmail(c.from_addr, to, msg.as_string())
