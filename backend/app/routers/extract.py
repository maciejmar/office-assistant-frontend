from fastapi import APIRouter, UploadFile, File, HTTPException
from typing import Optional
import io

router = APIRouter(prefix="/extract-text", tags=["extract"])


@router.post("")
async def extract_text(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing file")
    content = await file.read()

    content_type = (file.content_type or "").lower()
    filename = (file.filename or "").lower()

    def ext_from_filename(name: str) -> Optional[str]:
        if "." not in name:
            return None
        return name.rsplit(".", 1)[-1]

    ext = ext_from_filename(filename)

    # Text-like files
    if content_type.startswith("text/") or ext in {"txt", "md", "csv"}:
        try:
            text = content.decode("utf-8")
        except Exception:
            text = content.decode("utf-8", errors="replace")
        return {"text": text}

    # PDF
    if content_type == "application/pdf" or ext == "pdf":
        try:
            from pypdf import PdfReader
        except Exception:
            raise HTTPException(status_code=500, detail="PDF support not available")
        try:
            reader = PdfReader(io.BytesIO(content))
            parts = []
            for page in reader.pages:
                parts.append(page.extract_text() or "")
            return {"text": "\n".join(parts).strip()}
        except Exception:
            raise HTTPException(status_code=415, detail="Unsupported file type")

    # DOCX
    if (
        content_type
        == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        or ext == "docx"
    ):
        try:
            from docx import Document
        except Exception:
            raise HTTPException(status_code=500, detail="DOCX support not available")
        try:
            doc = Document(io.BytesIO(content))
            text = "\n".join(p.text for p in doc.paragraphs)
            return {"text": text.strip()}
        except Exception:
            raise HTTPException(status_code=415, detail="Unsupported file type")

    raise HTTPException(status_code=415, detail="Unsupported file type")
