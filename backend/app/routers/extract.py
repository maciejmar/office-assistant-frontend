from fastapi import APIRouter, UploadFile, File, HTTPException

router = APIRouter(prefix="/extract-text", tags=["extract"])


@router.post("")
async def extract_text(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing file")
    content = await file.read()
    try:
        text = content.decode("utf-8")
    except Exception:
        raise HTTPException(status_code=415, detail="Unsupported file type")
    return {"text": text}
