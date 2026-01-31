import os
from datetime import datetime
from fastapi import HTTPException
from .config import settings
from .models import File


def ensure_storage_dir() -> None:
    os.makedirs(settings.storage_dir, exist_ok=True)


def save_file(file_rec: File, data: bytes) -> str:
    ensure_storage_dir()
    storage_key = file_rec.storage_key
    path = os.path.join(settings.storage_dir, storage_key)
    with open(path, "wb") as f:
        f.write(data)
    return path


def load_file(file_rec: File) -> bytes:
    path = os.path.join(settings.storage_dir, file_rec.storage_key)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File not found")
    with open(path, "rb") as f:
        return f.read()
