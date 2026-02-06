from fastapi import APIRouter, Depends, HTTPException, Response, Cookie
from sqlalchemy.orm import Session
from ..deps import get_db
from ..models import User
from ..schemas import AuthRegister, AuthLogin, AuthToken
from ..auth import hash_password, verify_password, create_access_token, create_refresh_token, decode_token

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register")
def register(payload: AuthRegister, db: Session = Depends(get_db)):
    exists = db.query(User).filter(User.email == payload.email).first()
    if exists:
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(email=payload.email, password_hash=hash_password(payload.password))
    db.add(user)
    db.commit()
    return {"ok": True}


@router.post("/login", response_model=AuthToken)
def login(payload: AuthLogin, response: Response, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    access = create_access_token(str(user.id))
    refresh = create_refresh_token(str(user.id))
    user.refresh_token_hash = hash_password(refresh)
    db.add(user)
    db.commit()
    response.set_cookie(
        "oa_refresh",
        refresh,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
    )
    return {"accessToken": access}


@router.post("/refresh", response_model=AuthToken)
def refresh(
    response: Response,
    oa_refresh: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
):
    if not oa_refresh:
        raise HTTPException(status_code=401, detail="Missing refresh")
    try:
        payload = decode_token(oa_refresh)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid refresh")
    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user or not user.refresh_token_hash:
        raise HTTPException(status_code=401, detail="Invalid refresh")
    if not verify_password(oa_refresh, user.refresh_token_hash):
        raise HTTPException(status_code=401, detail="Invalid refresh")
    access = create_access_token(str(user.id))
    return {"accessToken": access}


@router.post("/logout")
def logout(response: Response, db: Session = Depends(get_db), oa_refresh: str | None = Cookie(default=None)):
    if oa_refresh:
        try:
            payload = decode_token(oa_refresh)
            user_id = payload.get("sub")
            if user_id:
                user = db.query(User).filter(User.id == int(user_id)).first()
                if user:
                    user.refresh_token_hash = None
                    db.add(user)
                    db.commit()
        except Exception:
            pass
    response.delete_cookie("oa_refresh", path="/")
    return {"ok": True}
