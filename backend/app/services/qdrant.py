import httpx

from ..config import settings


def delete_points_for_file(user_id: int, file_id: int) -> None:
    """
    Best-effort cleanup of Qdrant payload records for a deleted file.
    We don't raise on failure to avoid blocking file deletion in UI.
    """
    base = settings.qdrant_url.rstrip("/")
    url = f"{base}/collections/{settings.qdrant_collection}/points/delete?wait=true"
    body = {
        "filter": {
            "must": [
                {"key": "user_id", "match": {"value": user_id}},
                {"key": "file_id", "match": {"value": file_id}},
            ]
        }
    }
    try:
        with httpx.Client(timeout=10) as client:
            client.post(url, json=body)
    except Exception:
        # Cleanup is optional; main delete path must stay responsive.
        pass
