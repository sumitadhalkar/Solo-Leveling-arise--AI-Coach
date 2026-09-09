"""ADMIN_TOKEN gate on POST /api/v1/admin/refresh-snapshot.

Open by default (no breaking change for existing deployments); once
ADMIN_TOKEN is set, callers must present it via X-Admin-Token.
"""
from app.core.config import settings


def test_admin_route_open_when_token_unset(client, monkeypatch):
    monkeypatch.setattr(settings, "ADMIN_TOKEN", "")
    import app.api.routes.admin as admin_route
    monkeypatch.setattr(admin_route, "refresh_snapshot", lambda: _async_true())

    r = client.post("/api/v1/admin/refresh-snapshot")
    assert r.status_code == 200


def test_admin_route_rejects_missing_token_when_set(client, monkeypatch):
    monkeypatch.setattr(settings, "ADMIN_TOKEN", "secret123")
    r = client.post("/api/v1/admin/refresh-snapshot")
    assert r.status_code == 401


def test_admin_route_rejects_wrong_token(client, monkeypatch):
    monkeypatch.setattr(settings, "ADMIN_TOKEN", "secret123")
    r = client.post("/api/v1/admin/refresh-snapshot", headers={"X-Admin-Token": "wrong"})
    assert r.status_code == 401


def test_admin_route_accepts_correct_token(client, monkeypatch):
    monkeypatch.setattr(settings, "ADMIN_TOKEN", "secret123")
    import app.api.routes.admin as admin_route
    monkeypatch.setattr(admin_route, "refresh_snapshot", lambda: _async_true())

    r = client.post("/api/v1/admin/refresh-snapshot", headers={"X-Admin-Token": "secret123"})
    assert r.status_code == 200


async def _async_true():
    return True
