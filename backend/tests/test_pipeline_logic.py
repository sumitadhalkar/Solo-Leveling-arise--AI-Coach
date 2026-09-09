"""Unit tests for the pure logic inside app/rag/pipeline.py — no network."""
import json

import app.rag.pipeline as pipeline
from app.schemas.coach import CoachRequest, HunterInput


def _req(**overrides):
    base = dict(game_mode="Guild Boss", boss=None, hunters=[], coaching_mode="strategy")
    base.update(overrides)
    return CoachRequest(**base)


# ── Progression stage detection ──────────────────────────────────────────────

def test_detect_stage_trusts_explicit_when_bp_zero():
    assert pipeline._detect_stage(0, "competitive") == "competitive"


def test_detect_stage_new():
    assert pipeline._detect_stage(50_000, "midgame") == "new"


def test_detect_stage_midgame():
    assert pipeline._detect_stage(500_000, "new") == "midgame"


def test_detect_stage_endgame():
    assert pipeline._detect_stage(1_000_000, "new") == "endgame"


def test_detect_stage_competitive():
    assert pipeline._detect_stage(5_000_000, "new") == "competitive"


def test_detect_stage_boundaries_are_exclusive_upper():
    assert pipeline._detect_stage(199_999, "x") == "new"
    assert pipeline._detect_stage(200_000, "x") == "midgame"
    assert pipeline._detect_stage(799_999, "x") == "midgame"
    assert pipeline._detect_stage(800_000, "x") == "endgame"
    assert pipeline._detect_stage(1_999_999, "x") == "endgame"
    assert pipeline._detect_stage(2_000_000, "x") == "competitive"


# ── Cache key generation ─────────────────────────────────────────────────────

def test_cache_key_deterministic():
    r1 = _req(hunters=[HunterInput(name="Cha Hae-In", advancement=2)])
    r2 = _req(hunters=[HunterInput(name="Cha Hae-In", advancement=2)])
    assert pipeline._cache_key(r1) == pipeline._cache_key(r2)


def test_cache_key_ignores_hunter_order():
    r1 = _req(hunters=[HunterInput(name="A"), HunterInput(name="B")])
    r2 = _req(hunters=[HunterInput(name="B"), HunterInput(name="A")])
    assert pipeline._cache_key(r1) == pipeline._cache_key(r2)


def test_cache_key_ignores_battle_power_and_jinwoo_power():
    r1 = _req(battle_power=100, jinwoo_power=100)
    r2 = _req(battle_power=999_999_999, jinwoo_power=999_999_999)
    assert pipeline._cache_key(r1) == pipeline._cache_key(r2)


def test_cache_key_changes_with_coaching_mode():
    r1 = _req(coaching_mode="strategy")
    r2 = _req(coaching_mode="boss_guide")
    assert pipeline._cache_key(r1) != pipeline._cache_key(r2)


def test_cache_key_changes_with_hunters():
    r1 = _req(hunters=[])
    r2 = _req(hunters=[HunterInput(name="Cha Hae-In")])
    assert pipeline._cache_key(r1) != pipeline._cache_key(r2)


def test_cache_key_changes_with_question():
    r1 = _req(question="Should I pull?")
    r2 = _req(question="Should I skip?")
    assert pipeline._cache_key(r1) != pipeline._cache_key(r2)


# ── JSON extraction / fallback ───────────────────────────────────────────────

def test_extract_json_plain():
    assert pipeline._extract_json('{"a": 1}') == {"a": 1}


def test_extract_json_strips_markdown_fences():
    text = "```json\n{\"a\": 1}\n```"
    assert pipeline._extract_json(text) == {"a": 1}


def test_extract_json_extracts_from_surrounding_prose():
    text = 'Sure! Here is the JSON:\n{"a": 1}\nHope that helps.'
    assert pipeline._extract_json(text) == {"a": 1}


def test_extract_json_none_input_does_not_crash():
    """Regression test: Gemini's .text can legitimately be None (safety
    filtering / empty candidates). This must degrade gracefully, not raise
    AttributeError: 'NoneType' object has no attribute 'strip'."""
    result = pipeline._extract_json(None)
    assert result["parse_error"]


def test_extract_json_empty_string_does_not_crash():
    result = pipeline._extract_json("")
    assert result["parse_error"]


def test_extract_json_unparseable_returns_parse_error():
    result = pipeline._extract_json("this is not json at all")
    assert "parse_error" in result
    assert result["raw_response"] == "this is not json at all"


# ── Rate-limit / transient error classification ──────────────────────────────

def test_is_rate_limit_detects_429_variants():
    assert pipeline._is_rate_limit(Exception("429 RESOURCE_EXHAUSTED"))
    assert pipeline._is_rate_limit(Exception("Error code: 429 - rate_limit_exceeded"))
    assert pipeline._is_rate_limit(Exception("Too Many Requests"))


def test_is_rate_limit_false_for_unrelated_error():
    assert not pipeline._is_rate_limit(Exception("'NoneType' object has no attribute 'strip'"))


def test_is_transient_detects_5xx_and_timeouts():
    assert pipeline._is_transient(Exception("503 Service Unavailable"))
    assert pipeline._is_transient(Exception("Deadline exceeded"))
    assert pipeline._is_transient(Exception("Connection reset by peer"))


def test_friendly_error_maps_known_causes():
    assert "heavy load" in pipeline._friendly_error("503 UNAVAILABLE")
    assert "daily AI request limit" in pipeline._friendly_error("429 RESOURCE_EXHAUSTED")
    assert "not configured correctly" in pipeline._friendly_error("401 unauthenticated")
    assert "too long" in pipeline._friendly_error("deadline exceeded")
    assert pipeline._friendly_error("some totally unrecognized error")  # generic fallback, non-empty


# ── Search decision logic ────────────────────────────────────────────────────

def test_should_search_true_when_snapshot_missing(monkeypatch):
    monkeypatch.setattr(pipeline, "_SNAPSHOT_PATH", pipeline._SNAPSHOT_PATH.parent / "does_not_exist.json")
    assert pipeline._should_search(_req()) is True


def test_should_search_true_for_pull_advisor(monkeypatch):
    monkeypatch.setattr(pipeline, "_snapshot_age_minutes", lambda: 1.0)
    monkeypatch.setattr(pipeline, "_get_snapshot_confidence", lambda: 0.95)
    monkeypatch.setattr(pipeline, "_get_snapshot_known_hunters", lambda: set())
    assert pipeline._should_search(_req(coaching_mode="pull_advisor")) is True


def test_should_search_true_for_stale_snapshot(monkeypatch):
    monkeypatch.setattr(pipeline, "_snapshot_age_minutes", lambda: 999.0)
    monkeypatch.setattr(pipeline, "_get_snapshot_confidence", lambda: 0.95)
    assert pipeline._should_search(_req()) is True


def test_should_search_true_for_low_confidence_snapshot(monkeypatch):
    monkeypatch.setattr(pipeline, "_snapshot_age_minutes", lambda: 1.0)
    monkeypatch.setattr(pipeline, "_get_snapshot_confidence", lambda: 0.1)
    assert pipeline._should_search(_req()) is True


def test_should_search_true_for_volatile_keyword(monkeypatch):
    monkeypatch.setattr(pipeline, "_snapshot_age_minutes", lambda: 1.0)
    monkeypatch.setattr(pipeline, "_get_snapshot_confidence", lambda: 0.95)
    monkeypatch.setattr(pipeline, "_get_snapshot_known_hunters", lambda: set())
    for kw in ("patch", "update", "buff", "nerf", "latest", "banner", "release", "hotfix", "rework"):
        req = _req(question=f"what's the {kw} this week?")
        assert pipeline._should_search(req) is True, f"keyword '{kw}' should trigger search"


def test_should_search_false_for_fresh_high_confidence_stable_query(monkeypatch):
    monkeypatch.setattr(pipeline, "_snapshot_age_minutes", lambda: 1.0)
    monkeypatch.setattr(pipeline, "_get_snapshot_confidence", lambda: 0.95)
    monkeypatch.setattr(pipeline, "_get_snapshot_known_hunters", lambda: {"Cha Hae-In"})
    req = _req(hunters=[HunterInput(name="Cha Hae-In")], question="best build?")
    assert pipeline._should_search(req) is False


def test_should_search_true_when_primary_hunter_unknown_to_snapshot(monkeypatch):
    monkeypatch.setattr(pipeline, "_snapshot_age_minutes", lambda: 1.0)
    monkeypatch.setattr(pipeline, "_get_snapshot_confidence", lambda: 0.95)
    monkeypatch.setattr(pipeline, "_get_snapshot_known_hunters", lambda: {"Cha Hae-In"})
    req = _req(hunters=[HunterInput(name="Some Brand New Hunter")])
    assert pipeline._should_search(req) is True
