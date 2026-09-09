/**
 * Tests the SSE parsing contract in api.js against a hand-built fake
 * `fetch` — no real network, no real backend. Covers the requirements in
 * the project's testing checklist: chunk/status/result/error events,
 * incomplete-line buffering across reads, and a stream that closes without
 * ever sending a result.
 */
import { getStrategyStream } from './api';

function fakeReader(lines) {
  // Each entry in `lines` is a raw chunk of bytes (as a string) delivered by
  // one reader.read() call — deliberately split mid-line in some tests to
  // exercise the buffering logic.
  let i = 0;
  const encoder = new TextEncoder();
  return {
    read: jest.fn(async () => {
      if (i >= lines.length) return { done: true, value: undefined };
      const value = encoder.encode(lines[i]);
      i += 1;
      return { done: false, value };
    }),
    releaseLock: jest.fn(),
  };
}

function mockFetchWithLines(lines, { ok = true, status = 200 } = {}) {
  global.fetch = jest.fn(async () => ({
    ok,
    status,
    text: async () => '',
    body: { getReader: () => fakeReader(lines) },
  }));
}

describe('getStrategyStream', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  test('parses chunk then result events split across multiple reads', async () => {
    mockFetchWithLines([
      'data: {"type": "chunk", "text": "hello"}\n\n',
      'data: {"type": "result", "data": {"why": "ok"}}\n\n',
    ]);

    const onChunk = jest.fn();
    const onResult = jest.fn();
    const onError = jest.fn();

    await getStrategyStream({}, { onChunk, onResult, onError });

    expect(onChunk).toHaveBeenCalledWith('hello');
    expect(onResult).toHaveBeenCalledWith({ why: 'ok' });
    expect(onError).not.toHaveBeenCalled();
  });

  test('buffers an incomplete trailing line across reads', async () => {
    // Split the "result" SSE line itself across two read() calls.
    mockFetchWithLines([
      'data: {"type": "result", "da',
      'ta": {"why": "split"}}\n\n',
    ]);

    const onResult = jest.fn();
    await getStrategyStream({}, { onResult, onError: jest.fn() });

    expect(onResult).toHaveBeenCalledWith({ why: 'split' });
  });

  test('handles status events', async () => {
    mockFetchWithLines([
      'data: {"type": "status", "message": "Model busy - retrying..."}\n\n',
      'data: {"type": "result", "data": {"why": "done"}}\n\n',
    ]);

    const onStatus = jest.fn();
    await getStrategyStream({}, { onStatus, onResult: jest.fn(), onError: jest.fn() });

    expect(onStatus).toHaveBeenCalledWith('Model busy - retrying...');
  });

  test('skips malformed JSON lines instead of throwing', async () => {
    mockFetchWithLines([
      'data: {this is not valid json}\n\n',
      'data: {"type": "result", "data": {"why": "recovered"}}\n\n',
    ]);

    const onResult = jest.fn();
    const onError = jest.fn();
    await getStrategyStream({}, { onResult, onError });

    expect(onResult).toHaveBeenCalledWith({ why: 'recovered' });
    expect(onError).not.toHaveBeenCalled();
  });

  test('calls onError for a server-sent error event', async () => {
    mockFetchWithLines(['data: {"type": "error", "message": "boom"}\n\n']);

    const onError = jest.fn();
    const onResult = jest.fn();
    await getStrategyStream({}, { onError, onResult });

    expect(onError).toHaveBeenCalledWith(new Error('boom'));
    expect(onResult).not.toHaveBeenCalled();
  });

  test('stream closing without a result or error surfaces a clear error (no infinite loading)', async () => {
    mockFetchWithLines(['data: {"type": "chunk", "text": "partial..."}\n\n']);

    const onError = jest.fn();
    await getStrategyStream({}, { onChunk: jest.fn(), onError });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0].message).toMatch(/connection closed/i);
  });

  test('non-ok HTTP response calls onError with status info', async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 500,
      text: async () => 'internal error',
    }));

    const onError = jest.fn();
    await getStrategyStream({}, { onError });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0].message).toMatch(/500/);
  });

  test('network-level fetch failure produces a friendly error, not a raw TypeError', async () => {
    global.fetch = jest.fn(async () => { throw new TypeError('Failed to fetch'); });

    const onError = jest.fn();
    await getStrategyStream({}, { onError });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0].message).toMatch(/could not reach the coaching server/i);
  });
});
