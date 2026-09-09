"""
Shared test fixtures.

Tests never hit the real Gemini/NVIDIA APIs — every test that exercises the
pipeline monkeypatches the provider-call functions (_sync_generate /
_sync_stream) rather than relying on real credentials or network access, so
the suite is deterministic and runs the same with or without a .env file.

The background workers (snapshot refresh, roster sync) are stubbed out
before the FastAPI app's lifespan starts them, so importing/using the app in
tests never fires a real Google Search call on startup.
"""
import asyncio
import os
import sys
from pathlib import Path

import pytest

# Dummy keys so Settings() has *something* to work with even if the real
# .env is absent/misconfigured in the test environment — never real secrets.
os.environ.setdefault("GEMINI_API_KEY", "test-gemini-key-1")
os.environ.setdefault("NVIDIA_API_KEY", "test-nvidia-key-1")

sys.path.insert(0, str(Path(__file__).parent.parent))


async def _noop_worker():
    """Replaces the real background workers for the lifetime of a test app —
    starts and returns immediately instead of looping forever / calling out."""
    await asyncio.sleep(0)


@pytest.fixture
def client(monkeypatch):
    from fastapi.testclient import TestClient
    import app.main as main

    monkeypatch.setattr(main, "snapshot_worker", _noop_worker)
    monkeypatch.setattr(main, "roster_sync_worker", _noop_worker)

    with TestClient(main.app) as c:
        yield c
