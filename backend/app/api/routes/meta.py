import json
from pathlib import Path

from fastapi import APIRouter

from app.workers.roster_sync import get_current_roster

router = APIRouter()
_SNAPSHOT_PATH = Path(__file__).parent.parent.parent.parent / "meta_snapshot.json"


@router.get("/snapshot")
async def get_meta_snapshot():
    try:
        data = json.loads(_SNAPSHOT_PATH.read_text())
        return data
    except FileNotFoundError:
        return {
            "error": "Snapshot not yet generated — background worker runs every 30 min",
            "authoritative": {},
            "meta_reference": {},
            "community_opinion": {},
            "confidence": 0.0,
        }
    except Exception as e:
        return {"error": str(e), "authoritative": {}, "meta_reference": {}, "community_opinion": {}, "confidence": 0.0}


@router.get("/hunters")
async def get_hunters():
    """Live-synced hunter roster — hand-curated entries plus any hunters the
    background roster_sync worker has since discovered on official sources.
    Always returns a full roster: falls back to the hand-curated seed if the
    live sync file doesn't exist yet (e.g. right after a fresh deploy)."""
    return get_current_roster()
