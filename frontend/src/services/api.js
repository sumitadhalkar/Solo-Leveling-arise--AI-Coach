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

export const listHunters = () => req('/hunters/');

export const listBosses = (mode) =>
  req(mode ? `/bosses/?mode=${encodeURIComponent(mode)}` : '/bosses/');
