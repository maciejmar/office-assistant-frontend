import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from .config import settings


def send_email(to: str, subject: str, html: str, text: str) -> None:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from
    msg["To"] = to
    msg.attach(MIMEText(text, "plain", "utf-8"))
    msg.attach(MIMEText(html, "html", "utf-8"))

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as s:
        s.ehlo()
        if settings.smtp_tls:
            s.starttls()
            s.ehlo()
        if settings.smtp_user and settings.smtp_password:
            s.login(settings.smtp_user, settings.smtp_password)
        s.sendmail(settings.smtp_from, to, msg.as_string())
