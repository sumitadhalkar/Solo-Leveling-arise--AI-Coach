// Feature 9 — Personalized Coaching Memory (localStorage)
// Stores: roster, spending level, progression stage, coaching preferences

const KEY = 'arise_coach_memory';

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
}

function save(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...load(), ...data }));
  } catch {
    // localStorage unavailable (SSR / privacy mode) — silently skip
  }
}

export function saveRoster(hunters) {
  save({ hunters });
}

export function saveProfile(profile) {
  // profile = { spending_level, progression_stage, coaching_mode }
  save({ profile });
}

export function loadRoster() {
  return load().hunters || [];
}

export function loadProfile() {
  return load().profile || {
    spending_level: 'f2p',
    progression_stage: 'midgame',
    coaching_mode: 'strategy',
  };
}

export function clearMemory() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
