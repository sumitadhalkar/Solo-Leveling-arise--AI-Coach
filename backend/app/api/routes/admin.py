from fastapi import APIRouter

from app.workers.snapshot import SNAPSHOT_PATH, refresh_snapshot

router = APIRouter()


@router.post("/refresh-snapshot")
async def force_refresh():
    """Force an immediate meta snapshot refresh — useful right after a major patch."""
    success = await refresh_snapshot()
    snap = {}
    try:
        import json
        snap = json.loads(SNAPSHOT_PATH.read_text())
    except Exception:
        pass
    return {
        "success":    success,
        "patch":      snap.get("authoritative", {}).get("patch"),
        "confidence": snap.get("confidence", 0),
        "updated_at": snap.get("last_updated"),
    }
