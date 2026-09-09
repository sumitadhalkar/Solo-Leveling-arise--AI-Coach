"""Cache hit/miss, SSE event generation, and rate-limit failover — all with
_sync_generate/_sync_stream mocked out so no real provider is ever called."""
import asyncio

import pytest

import app.rag.pipeline as pipeline
from app.schemas.coach import CoachRequest, HunterInput


def _req(**overrides):
    base = dict(game_mode="Guild Boss", boss=None, hunters=[HunterInput(name="Test Hunter")],
                coaching_mode="strategy")
    base.update(overrides)
    return CoachRequest(**base)


@pytest.fixture(autouse=True)
def _clean_cache_and_pools(monkeypatch):
    """Isolate each test from the module-level cache/cooldown state."""
    pipeline._response_cache.clear()
    monkeypatch.setattr(pipeline, "_key_cooldowns", {})
    monkeypatch.setattr(pipeline, "_gemini_pool", [("fake-gemini-key", object())])
    monkeypatch.setattr(pipeline, "_compat_pool", [])
    monkeypatch.setattr(pipeline, "_init_pools", lambda: None)  # pools pre-seeded above
    yield
    pipeline._response_cache.clear()


@pytest.mark.asyncio
async def test_cache_miss_then_hit(monkeypatch):
    calls = {"n": 0}

    def fake_generate(provider, client, model, prompt, use_search):
        calls["n"] += 1
        return '{"why": "first call"}'

    monkeypatch.setattr(pipeline, "_sync_generate", fake_generate)

    req = _req()
    result1 = await pipeline.run_coach_pipeline(req)
    assert result1["why"] == "first call"
    assert calls["n"] == 1

    # Identical request again -> served from cache, provider not called again.
    result2 = await pipeline.run_coach_pipeline(req)
    assert result2 == result1
    assert calls["n"] == 1


@pytest.mark.asyncio
async def test_parse_failures_are_not_cached(monkeypatch):
    monkeypatch.setattr(pipeline, "_sync_generate", lambda *a, **k: "not valid json at all")

    req = _req(question="unique-key-for-this-test")
    result = await pipeline.run_coach_pipeline(req)
    assert "parse_error" in result
    assert pipeline._cache_key(req) not in pipeline._response_cache


@pytest.mark.asyncio
async def test_rate_limit_fails_over_to_a_different_key(monkeypatch):
    """First key hits 429, a second (already-available) key should be tried
    without waiting out the retry backoff."""
    monkeypatch.setattr(pipeline, "_gemini_pool", [("bad-key", object()), ("good-key", object())])

    attempts = []

    def fake_generate(provider, client, model, prompt, use_search):
        attempts.append(client)
        if len(attempts) == 1:
            raise Exception("429 RESOURCE_EXHAUSTED: quota exceeded")
        return '{"why": "second key worked"}'

    monkeypatch.setattr(pipeline, "_sync_generate", fake_generate)

    result = await pipeline.run_coach_pipeline(_req())
    assert result["why"] == "second key worked"
    assert len(attempts) == 2


@pytest.mark.asyncio
async def test_non_retryable_error_returns_friendly_message_immediately(monkeypatch):
    def fake_generate(*a, **k):
        raise Exception("some completely unrecognized failure")

    monkeypatch.setattr(pipeline, "_sync_generate", fake_generate)

    result = await pipeline.run_coach_pipeline(_req())
    assert "parse_error" in result
    assert result["error"]  # friendly message present


@pytest.mark.asyncio
async def test_none_text_from_provider_does_not_crash(monkeypatch):
    """Regression test for the AttributeError bug: a provider response whose
    .text is None must not blow up the whole request."""
    monkeypatch.setattr(pipeline, "_sync_generate", lambda *a, **k: None)

    result = await pipeline.run_coach_pipeline(_req())
    assert "parse_error" in result  # graceful, not a crash


@pytest.mark.asyncio
async def test_streaming_emits_chunks_then_result(monkeypatch):
    def fake_stream(provider, client, model, prompt, use_search, queue, loop):
        for piece in ('{"why"', ': "streamed"}'):
            loop.call_soon_threadsafe(queue.put_nowait, ("chunk", piece))
        loop.call_soon_threadsafe(queue.put_nowait, ("done", None))

    monkeypatch.setattr(pipeline, "_sync_stream", fake_stream)

    events = []
    async for line in pipeline.run_coach_pipeline_stream(_req(question="stream-test")):
        events.append(line)

    assert any('"type": "chunk"' in e for e in events)
    assert any('"type": "result"' in e for e in events)
    result_line = [e for e in events if '"type": "result"' in e][0]
    assert "streamed" in result_line


@pytest.mark.asyncio
async def test_streaming_error_event_on_total_failure(monkeypatch):
    def fake_stream(provider, client, model, prompt, use_search, queue, loop):
        loop.call_soon_threadsafe(queue.put_nowait, ("error", "some completely unrecognized failure"))
        loop.call_soon_threadsafe(queue.put_nowait, ("done", None))

    monkeypatch.setattr(pipeline, "_sync_stream", fake_stream)

    events = []
    async for line in pipeline.run_coach_pipeline_stream(_req(question="stream-error-test")):
        events.append(line)

    assert any('"type": "error"' in e for e in events)
    assert not any('"type": "result"' in e for e in events)
