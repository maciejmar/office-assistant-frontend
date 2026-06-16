import smtplib
from email.mime.text import MIMEText

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..deps import get_db, get_current_user
from ..models import User, UserSmtpConfig
from ..schemas import SmtpConfigIn, SmtpConfigOut

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("/smtp", response_model=SmtpConfigOut)
def get_smtp(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    cfg = db.query(UserSmtpConfig).filter(UserSmtpConfig.user_id == user.id).first()
    if not cfg:
        raise HTTPException(status_code=404, detail="SMTP not configured")
    return SmtpConfigOut(
        host=cfg.host,
        port=cfg.port,
        tls=cfg.tls,
        username=cfg.username,
        from_addr=cfg.from_addr,
        imap_host=cfg.imap_host,
        imap_port=cfg.imap_port or 993,
    )


@router.put("/smtp", response_model=SmtpConfigOut)
def save_smtp(payload: SmtpConfigIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    cfg = db.query(UserSmtpConfig).filter(UserSmtpConfig.user_id == user.id).first()
    if cfg:
        cfg.host = payload.host
        cfg.port = payload.port
        cfg.tls = payload.tls
        cfg.username = payload.username
        if payload.password:
            cfg.password = payload.password.replace(" ", "")
        cfg.from_addr = payload.from_addr
        cfg.imap_host = payload.imap_host
        cfg.imap_port = payload.imap_port
    else:
        cfg = UserSmtpConfig(
            user_id=user.id,
            host=payload.host,
            port=payload.port,
            tls=payload.tls,
            username=payload.username,
            password=payload.password,
            from_addr=payload.from_addr,
            imap_host=payload.imap_host,
            imap_port=payload.imap_port,
        )
        db.add(cfg)
    db.commit()
    return SmtpConfigOut(
        host=cfg.host,
        port=cfg.port,
        tls=cfg.tls,
        username=cfg.username,
        from_addr=cfg.from_addr,
        imap_host=cfg.imap_host,
        imap_port=cfg.imap_port or 993,
    )


@router.post("/smtp/test")
def test_smtp(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    cfg = db.query(UserSmtpConfig).filter(UserSmtpConfig.user_id == user.id).first()
    if not cfg:
        raise HTTPException(status_code=404, detail="SMTP not configured")
    try:
        msg = MIMEText("Test połączenia SMTP z Office Assistant.", "plain", "utf-8")
        msg["Subject"] = "Test SMTP — Office Assistant"
        msg["From"] = cfg.from_addr
        msg["To"] = cfg.username
        with smtplib.SMTP(cfg.host, cfg.port) as s:
            s.ehlo()
            if cfg.tls:
                s.starttls()
                s.ehlo()
            if cfg.username and cfg.password:
                s.login(cfg.username, cfg.password)
            s.sendmail(cfg.from_addr, cfg.username, msg.as_string())
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Test nieudany: {e}")
    return {"ok": True, "message": f"Test wysłany na {cfg.username}"}
