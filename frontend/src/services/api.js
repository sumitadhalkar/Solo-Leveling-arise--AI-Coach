const BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) {
    const text = await res.text();
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
 *   onChunk(text)   — called for each incremental text chunk
 *   onResult(data)  — called once with the final parsed JSON object
 *   onError(error)  — called if the stream errors
 */
export async function getStrategyStream(payload, { onChunk, onResult, onError }) {
  let res;
  try {
    res = await fetch(`${BASE}/coach/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    onError(e);
    return;
  }

  if (!res.ok) {
    const text = await res.text();
    onError(new Error(`${res.status}: ${text}`));
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

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
        else if (msg.type === 'result') onResult(msg.data);
        else if (msg.type === 'error') onError(new Error(msg.message));
      }
    }
  } catch (e) {
    onError(e);
  } finally {
    reader.releaseLock();
  }
}

export const postFeedback = (payload) =>
  req('/coach/feedback', { method: 'POST', body: JSON.stringify(payload) });

export const listHunters = () => req('/hunters/');

export const listBosses = (mode) =>
  req(mode ? `/bosses/?mode=${encodeURIComponent(mode)}` : '/bosses/');

export const getSnapshot = () => req('/meta/snapshot');
