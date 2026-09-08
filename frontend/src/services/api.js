const BASE = (process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1').replace(/\/+$/, '');

// The backend runs on a free Render instance that spins down when idle, so the
// first request after a quiet period pays a ~30-60s cold start on top of the
// model call. Anything shorter than this aborts perfectly healthy requests.
const REQUEST_TIMEOUT_MS = 240000;

/**
 * `fetch` rejects with an opaque TypeError for every transport-level failure —
 * CORS rejection, DNS failure, offline, connection reset all surface as
 * "NetworkError when attempting to fetch resource" (Firefox) or "Failed to
 * fetch" (Chrome). Turn that into something a user can act on.
 */
function describeNetworkError(e) {
  if (e?.name === 'AbortError') {
    return 'The server took too long to respond. It may be waking up from idle — please try again.';
  }
  if (e instanceof TypeError) {
    return 'Could not reach the coaching server. It may be starting up after being idle — wait a moment and try again.';
  }
  return e?.message || 'An unexpected error occurred.';
}

function withTimeout(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

async function req(path, opts = {}) {
  const { signal, clear } = withTimeout(REQUEST_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      signal,
      ...opts,
    });
  } catch (e) {
    throw new Error(describeNetworkError(e));
  } finally {
    clear();
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json();
}

export const getStrategy = (payload) =>
  req('/coach/strategy', { method: 'POST', body: JSON.stringify(payload) });

/**
 * Streaming variant — uses SSE via fetch ReadableStream.
 *
 * Callbacks:
 *   onChunk(text)     — called for each incremental text chunk
 *   onStatus(message) — called when the server reports a retry / progress note
 *   onResult(data)    — called once with the final parsed JSON object
 *   onError(error)    — called if the stream errors
 */
export async function getStrategyStream(payload, { onChunk, onStatus, onResult, onError }) {
  const { signal, clear } = withTimeout(REQUEST_TIMEOUT_MS);
  let res;

  try {
    res = await fetch(`${BASE}/coach/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (e) {
    clear();
    onError(new Error(describeNetworkError(e)));
    return;
  }

  if (!res.ok) {
    clear();
    const text = await res.text().catch(() => '');
    onError(new Error(`Server error ${res.status}. ${text.slice(0, 200)}`));
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let sawResult = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep the incomplete trailing line

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (!raw) continue;

        let msg;
        try { msg = JSON.parse(raw); } catch { continue; }

        if (msg.type === 'chunk') onChunk?.(msg.text);
        else if (msg.type === 'status') onStatus?.(msg.message);
        else if (msg.type === 'result') { sawResult = true; onResult(msg.data); }
        else if (msg.type === 'error') { sawResult = true; onError(new Error(msg.message)); }
      }
    }

    // A stream that ends without a result or error means the connection was cut
    // mid-flight; without this the UI would spin forever.
    if (!sawResult) {
      onError(new Error('The connection closed before a strategy was returned. Please try again.'));
    }
  } catch (e) {
    onError(new Error(describeNetworkError(e)));
  } finally {
    clear();
    reader.releaseLock();
  }
}

export const postFeedback = (payload) =>
  req('/coach/feedback', { method: 'POST', body: JSON.stringify(payload) });

export const getSnapshot = () => req('/meta/snapshot');
