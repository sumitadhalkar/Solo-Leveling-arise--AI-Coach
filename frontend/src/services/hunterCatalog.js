import { useEffect, useState } from 'react';
import { HUNTERS as SEED_HUNTERS } from '../data/hunters';
import { getHunters } from './api';

/**
 * Single source of truth for "which hunters exist", shared by the Hunters
 * Database page and the roster builder. Renders instantly from the bundled
 * seed data, then swaps in the backend's live-synced roster (hand-curated
 * entries + anything the roster_sync worker has since discovered from
 * official sources) once it arrives — so a hunter released after this build
 * shipped still shows up without waiting on a frontend redeploy.
 *
 * Cached at module scope so every page that calls this shares one fetch
 * instead of re-requesting the same roster on every navigation.
 */
let cache = null;
let inFlight = null;

function fetchOnce() {
  if (!inFlight) {
    inFlight = getHunters().catch(() => null);
  }
  return inFlight;
}

export function useHunterCatalog() {
  const [hunters, setHunters] = useState(cache?.hunters || SEED_HUNTERS);
  const [meta, setMeta] = useState(cache?.meta || null);

  useEffect(() => {
    if (cache) return; // another page already resolved this session's fetch
    let cancelled = false;

    fetchOnce().then((data) => {
      if (cancelled || !data || !Array.isArray(data.hunters) || data.hunters.length === 0) {
        return; // backend unreachable or empty — keep the bundled seed, no error shown
      }
      cache = { hunters: data.hunters, meta: { autoAdded: data.auto_added || [], lastChecked: data.last_checked } };
      setHunters(cache.hunters);
      setMeta(cache.meta);
    });

    return () => { cancelled = true; };
  }, []);

  return { hunters, meta };
}
