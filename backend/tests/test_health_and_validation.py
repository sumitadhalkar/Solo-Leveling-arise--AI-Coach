"""Health endpoint + request validation (schema contract)."""


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "service": "arise-coach-backend"}


def test_strategy_rejects_invalid_coaching_mode(client):
    r = client.post("/api/v1/coach/strategy", json={
        "game_mode": "x", "hunters": [], "coaching_mode": "not_a_real_mode",
    })
    assert r.status_code == 422


def test_strategy_rejects_invalid_spending_level(client):
    r = client.post("/api/v1/coach/strategy", json={
        "game_mode": "x", "hunters": [], "spending_level": "rich",
    })
    assert r.status_code == 422


def test_strategy_rejects_invalid_progression_stage(client):
    r = client.post("/api/v1/coach/strategy", json={
        "game_mode": "x", "hunters": [], "progression_stage": "godlike",
    })
    assert r.status_code == 422


def test_strategy_requires_game_mode(client):
    r = client.post("/api/v1/coach/strategy", json={"hunters": []})
    assert r.status_code == 422
    assert any(e["loc"] == ["body", "game_mode"] for e in r.json()["detail"])


def test_strategy_requires_hunters(client):
    r = client.post("/api/v1/coach/strategy", json={"game_mode": "x"})
    assert r.status_code == 422


def test_strategy_rejects_malformed_json(client):
    r = client.post(
        "/api/v1/coach/strategy",
        data="{not valid json",
        headers={"Content-Type": "application/json"},
    )
    assert r.status_code == 422


def test_hunter_power_rejects_non_numeric_string(client):
    r = client.post("/api/v1/coach/strategy", json={
        "game_mode": "x", "hunters": [{"name": "Test", "power": "abc"}],
    })
    assert r.status_code == 422


def test_hunter_power_coerces_numeric_string(client, monkeypatch):
    # "123.0" is a valid float string -> should coerce to int(123), not 422.
    import app.rag.pipeline as pipeline
    monkeypatch.setattr(pipeline, "_sync_generate", lambda *a, **k: '{"why": "ok"}')

    r = client.post("/api/v1/coach/strategy", json={
        "game_mode": "x", "hunters": [{"name": "Test", "power": "123.0"}],
    })
    assert r.status_code == 200


def test_feedback_rejects_invalid_rating(client):
    r = client.post("/api/v1/coach/feedback", json={"rating": 5, "coaching_mode": "strategy"})
    assert r.status_code == 422


def test_feedback_accepts_valid_rating(client):
    r = client.post("/api/v1/coach/feedback", json={"rating": 1, "coaching_mode": "strategy"})
    assert r.status_code == 200
    assert r.json() == {"ok": True}


def test_nonexistent_route_404s(client):
    r = client.get("/api/v1/coach/nonexistent")
    assert r.status_code == 404


def test_empty_roster_is_valid(client, monkeypatch):
    """An empty roster is a legitimate request shape (new player, no hunters
    yet) — it must not be rejected by validation."""
    import app.rag.pipeline as pipeline
    monkeypatch.setattr(pipeline, "_sync_generate", lambda *a, **k: '{"why": "ok"}')

    r = client.post("/api/v1/coach/strategy", json={"game_mode": "x", "hunters": []})
    assert r.status_code == 200
