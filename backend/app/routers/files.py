from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session
from ..deps import get_db, get_current_user
from ..models import File, User
from ..schemas import FileOut, FilePresignIn, FilePresignOut
from ..storage import save_file, load_file

router = APIRouter(prefix="/files", tags=["files"])


@router.get("", response_model=list[FileOut])
def list_files(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    items = db.query(File).filter(File.user_id == user.id).all()
    return [
        FileOut(
            id=f.id,
            filename=f.filename,
            status=f.status,
            uploaded_at=f.uploaded_at.isoformat() if f.uploaded_at else None,
        )
        for f in items
    ]


@router.post("/presign", response_model=FilePresignOut)
def presign(
    payload: FilePresignIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    file_rec = File(
        user_id=user.id,
        filename=payload.filename,
        status="pending",
        storage_key=f"{user.id}_{int(datetime.utcnow().timestamp())}_{payload.filename}",
        mime=payload.mime,
        size=payload.size,
    )
    db.add(file_rec)
    db.commit()
    db.refresh(file_rec)
    upload_url = f"/api/files/upload/{file_rec.id}"
    return FilePresignOut(uploadUrl=upload_url, fileId=file_rec.id)


@router.put("/upload/{file_id}")
async def upload(file_id: int, request: Request, db: Session = Depends(get_db)):
    file_rec = db.query(File).filter(File.id == file_id).first()
    if not file_rec:
        raise HTTPException(status_code=404, detail="File not found")
    data = await request.body()
    save_file(file_rec, data)
    file_rec.status = "uploaded"
    file_rec.uploaded_at = datetime.utcnow()
    db.add(file_rec)
    db.commit()
    return {"ok": True, "fileId": file_id}


@router.post("/complete")
def complete(payload: dict, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    file_id = payload.get("fileId")
    if not file_id:
        raise HTTPException(status_code=400, detail="Missing fileId")
    file_rec = db.query(File).filter(File.id == int(file_id), File.user_id == user.id).first()
    if not file_rec:
        raise HTTPException(status_code=404, detail="File not found")
    file_rec.status = "ready"
    db.add(file_rec)
    db.commit()
    return {"ok": True}


@router.delete("/{file_id}")
def delete_file(file_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.query(File).filter(File.id == file_id, File.user_id == user.id).delete()
    db.commit()
    return {"ok": True}


@router.get("/{file_id}/download")
def download(file_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    file_rec = db.query(File).filter(File.id == file_id, File.user_id == user.id).first()
    if not file_rec:
        raise HTTPException(status_code=404, detail="File not found")
    data = load_file(file_rec)
    return Response(content=data, media_type=file_rec.mime, headers={"Content-Disposition": f"attachment; filename={file_rec.filename}"})
