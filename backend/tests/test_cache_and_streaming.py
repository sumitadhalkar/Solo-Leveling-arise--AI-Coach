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


# ── Empty-provider-response regression tests ─────────────────────────────────
# A provider call that "succeeds" (no exception, no 429) but returns no usable
# text — safety filtering, an empty candidate, or a quota edge case that
# doesn't raise a normal 429 — must be treated as a retryable failure, not
# silently returned as a near-empty 200 response. These exercise the REAL
# _sync_generate/_sync_stream (not monkeypatched) against a fake provider
# client, so the actual detection logic is what's under test.

class _FakeGeminiChunk:
    def __init__(self, text=None):
        self.text = text


class _FakeGeminiModels:
    def __init__(self, text=None, chunks=None):
        self._text = text
        self._chunks = chunks or []

    def generate_content(self, **kwargs):
        return self._FakeResponse(self._text)

    def generate_content_stream(self, **kwargs):
        return iter(self._chunks)

    class _FakeResponse:
        def __init__(self, text):
            self.text = text


class _FakeGeminiClient:
    def __init__(self, text=None, chunks=None):
        self.models = _FakeGeminiModels(text=text, chunks=chunks)


def test_sync_generate_raises_on_empty_gemini_text():
    client = _FakeGeminiClient(text=None)
    with pytest.raises(RuntimeError, match="EMPTY_PROVIDER_RESPONSE"):
        pipeline._sync_generate("gemini", client, "fake-model", "prompt", False)


def test_sync_generate_raises_on_blank_gemini_text():
    client = _FakeGeminiClient(text="")
    with pytest.raises(RuntimeError, match="EMPTY_PROVIDER_RESPONSE"):
        pipeline._sync_generate("gemini", client, "fake-model", "prompt", False)


def test_sync_generate_succeeds_on_real_gemini_text():
    client = _FakeGeminiClient(text='{"why": "real content"}')
    result = pipeline._sync_generate("gemini", client, "fake-model", "prompt", False)
    assert result == '{"why": "real content"}'


@pytest.mark.asyncio
async def test_drain_stream_once_flags_all_empty_chunks_as_error():
    client = _FakeGeminiClient(chunks=[_FakeGeminiChunk(None), _FakeGeminiChunk("")])
    chunks, error = await pipeline._drain_stream_once("gemini", client, "fake-model", "prompt", False)
    assert chunks == []
    assert error is not None and "EMPTY_PROVIDER_RESPONSE" in error


@pytest.mark.asyncio
async def test_drain_stream_once_succeeds_with_real_chunks():
    client = _FakeGeminiClient(chunks=[_FakeGeminiChunk("hello "), _FakeGeminiChunk("world")])
    chunks, error = await pipeline._drain_stream_once("gemini", client, "fake-model", "prompt", False)
    assert chunks == ["hello ", "world"]
    assert error is None


@pytest.mark.asyncio
async def test_empty_response_fails_over_to_next_key_non_streaming(monkeypatch):
    """The full retry loop: an empty-text response on the first key must be
    treated like any other transient failure and fail over, not returned
    to the user as-is."""
    monkeypatch.setattr(pipeline, "_gemini_pool", [("bad-key", object()), ("good-key", object())])

    attempts = []

    def fake_generate(provider, client, model, prompt, use_search):
        attempts.append(client)
        if len(attempts) == 1:
            raise RuntimeError(pipeline._EMPTY_RESPONSE_MSG)
        return '{"why": "second key had real content"}'

    monkeypatch.setattr(pipeline, "_sync_generate", fake_generate)

    result = await pipeline.run_coach_pipeline(_req(question="empty-response-failover-test"))
    assert result["why"] == "second key had real content"
    assert len(attempts) == 2
