from fastapi import APIRouter, Depends, Header, HTTPException

from app.core.config import settings
from app.workers.snapshot import SNAPSHOT_PATH, refresh_snapshot

router = APIRouter()


def _check_admin_token(x_admin_token: str | None = Header(default=None)):
    """No-op (open) when ADMIN_TOKEN is unset — see config.py. Set it to
    require callers to pass the same value via the X-Admin-Token header."""
    if settings.ADMIN_TOKEN and x_admin_token != settings.ADMIN_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid or missing X-Admin-Token")


@router.post("/refresh-snapshot", dependencies=[Depends(_check_admin_token)])
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
