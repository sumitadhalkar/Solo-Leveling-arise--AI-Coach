"""
Background worker: keeps the hunter roster itself from going stale.

The hand-curated roster (app/data/hunters_seed.json) is accurate the day it's
written, but Solo Leveling: ARISE keeps releasing new hunters — without this,
a newly-released hunter would be unselectable in the roster builder and
missing from the Hunters Database until a developer noticed and shipped a
code change. That lag is exactly what makes an app feel abandoned.

This worker periodically asks Gemini (grounded with live Google Search,
restricted to official/verified sources) for the full current hunter list,
diffs it against what we already know, and — only for names we don't
recognize — generates a full profile in the same schema the hand-curated
entries use. Anything it adds is tagged auto_generated/verified=false so the
frontend can visually flag it rather than presenting a web-scraped guess with
the same authority as a hand-verified entry.

Runs far less often than the meta snapshot (new hunters ship roughly monthly,
not hourly) and is deliberately conservative: a malformed or incomplete
profile is discarded rather than merged, because a wrong build guide is worse
than a temporarily-missing hunter.

Deliberately Gemini-only, same reasoning as the meta snapshot worker: this is
all live Google Search grounding, and NVIDIA's endpoint (used elsewhere for
ordinary generation) has no equivalent — nothing to fail over to here.
"""
import asyncio
import json
import re
from datetime import datetime, timezone
from pathlib import Path

from google import genai
from google.genai import types

from app.core.config import settings

SEED_PATH = Path(__file__).parent.parent / "data" / "hunters_seed.json"
LIVE_PATH = Path(__file__).parent.parent.parent / "hunters_live.json"
INTERVAL = 6 * 3600  # 6 hours — new hunters release far less often than banners rotate
MAX_NEW_PER_CYCLE = 4  # cap API spend if the gap is ever large (e.g. after a big content update)

_VALID_ELEMENTS = {"light", "water", "fire", "earth", "wind", "dark"}
_VALID_RARITY   = {"SSR", "SR", "R"}
_VALID_TIER     = {"SS", "S+", "S", "A", "B"}

_DISCOVERY_PROMPT = """\
Search sololeveling.netmarble.com ONLY and list every currently-released
playable hunter in Solo Leveling: ARISE — the complete current roster, not
just recent additions.

Return ONLY a valid JSON object, no markdown fences, no prose:
{"hunters": ["Official Hunter Name", "..."]}

Use each hunter's official in-game name exactly as Netmarble writes it.
"""

_PROFILE_PROMPT_TEMPLATE = """\
Search sololeveling.netmarble.com (official kit/skill facts) and arise.tools
(community-verified builds/tiers) for the hunter "{name}" in Solo Leveling:
ARISE. Return ONLY a valid JSON object, no markdown fences, no prose:

{{
  "name": "{name}",
  "element": "light | water | fire | earth | wind | dark",
  "class": "short class name e.g. Fighter, Mage, Ranger, Tank, Healer, Assassin",
  "rarity": "SSR | SR | R",
  "tier": "SS | S+ | S | A | B",
  "trend": "rising | falling | stable",
  "pullValue": "Must Pull | Good | Situational | Skip",
  "role": "short role e.g. Main DPS, Sub DPS, Support, Tank",
  "playstyle": "2-3 sentence gameplay summary",
  "stats": {{"attack": 1-5, "defense": 1-5, "speed": 1-5, "utility": 1-5}},
  "skills": [
    {{"name": "...", "type": "Active | Ultimate | Passive", "desc": "..."}}
  ],
  "bestWeapons": ["..."],
  "artifacts": ["..."],
  "statPriority": ["..."],
  "f2pBuild": "1-2 sentence F2P-viable build guidance",
  "bestTeammates": ["..."],
  "antiSynergy": [],
  "description": "1-2 sentence summary of the hunter and their value"
}}

If you cannot verify a field from these sources, use your best publicly
available knowledge rather than inventing specifics. Do not fabricate skill
names — if a skill's real name is unknown, omit it from the "skills" array
rather than making one up.
"""


def _extract_json(text: str):
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    clean = re.sub(r"^```(?:json)?\s*", "", text, flags=re.MULTILINE)
    clean = re.sub(r"\s*```$", "", clean, flags=re.MULTILINE)
    try:
        return json.loads(clean.strip())
    except json.JSONDecodeError:
        pass
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if m:
        try:
            return json.loads(m.group())
        except json.JSONDecodeError:
            pass
    return None


def _load_seed() -> list[dict]:
    try:
        return json.loads(SEED_PATH.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"[roster_sync] Could not load seed roster: {e}")
        return []


def _load_live() -> dict:
    try:
        return json.loads(LIVE_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}


def get_current_roster() -> dict:
    """Public accessor for the API route — always returns a usable roster,
    falling back to the hand-curated seed if the live file is missing or
    corrupt (e.g. before the worker's first successful run)."""
    live = _load_live()
    hunters = live.get("hunters")
    if isinstance(hunters, list) and hunters:
        return live
    return {
        "hunters":    _load_seed(),
        "auto_added": [],
        "last_checked": None,
    }


def _validate_profile(expected_name: str, profile: dict) -> bool:
    """Reject anything that doesn't look like a real, complete profile —
    a missing hunter is a smaller problem than a confidently-wrong one."""
    if not isinstance(profile, dict):
        return False
    if not profile.get("name") or not isinstance(profile["name"], str):
        return False
    if profile.get("element") not in _VALID_ELEMENTS:
        return False
    if profile.get("rarity") not in _VALID_RARITY:
        return False
    if profile.get("tier") not in _VALID_TIER:
        return False
    stats = profile.get("stats")
    if not isinstance(stats, dict) or not all(
        isinstance(stats.get(k), (int, float)) and 1 <= stats.get(k, 0) <= 5
        for k in ("attack", "defense", "speed", "utility")
    ):
        return False
    skills = profile.get("skills")
    if not isinstance(skills, list) or len(skills) == 0:
        return False
    if not all(isinstance(s, dict) and s.get("name") and s.get("desc") for s in skills):
        return False
    return True


async def _generate_with_failover(prompt: str, keys: list[str]):
    """Try each configured key in turn, returning the first success. Any
    number of keys may be configured (comma-separated in either
    GEMINI_API_KEY or GEMINI_API_KEY_2) — a rate-limited key shouldn't stall
    discovery or profile generation when others are available."""
    config = types.GenerateContentConfig(tools=[types.Tool(google_search=types.GoogleSearch())])
    last_error: Exception = RuntimeError("no keys configured")
    for i, key in enumerate(keys):
        try:
            client = genai.Client(api_key=key)
            return await asyncio.to_thread(
                client.models.generate_content, model="gemini-3.6-flash", contents=prompt, config=config
            )
        except Exception as e:
            last_error = e
            print(f"[roster_sync] Key …{key[-6:]} failed ({e}) — "
                  f"{'trying next key' if i + 1 < len(keys) else 'no keys left'}")
    raise last_error


async def refresh_hunters() -> bool:
    keys = settings.gemini_keys()
    if not keys:
        return False

    seed = _load_seed()
    live = _load_live()
    known: list[dict] = live.get("hunters") if isinstance(live.get("hunters"), list) and live.get("hunters") else seed
    known_names = {h["name"].strip().lower() for h in known if h.get("name")}
    auto_added_names: list[str] = list(live.get("auto_added", []))

    try:
        discovery = await _generate_with_failover(_DISCOVERY_PROMPT, keys)
        data = _extract_json(discovery.text)
        official_names = (data or {}).get("hunters", [])
        if not isinstance(official_names, list):
            official_names = []
    except Exception as e:
        print(f"[roster_sync] Discovery search failed on all {len(keys)} key(s): {e}")
        return False

    missing = [
        n for n in official_names
        if isinstance(n, str) and n.strip() and n.strip().lower() not in known_names
    ][:MAX_NEW_PER_CYCLE]

    if not missing:
        # Nothing new — still refresh the checked-at timestamp so the UI can
        # show "verified Xm ago" and callers know the sync loop is alive.
        LIVE_PATH.write_text(json.dumps({
            "hunters":      known,
            "auto_added":   auto_added_names,
            "last_checked": datetime.now(timezone.utc).isoformat(),
        }, indent=2, ensure_ascii=False))
        print(f"[roster_sync] Checked — {len(official_names)} official hunters, none new")
        return True

    added = []
    for name in missing:
        try:
            resp = await _generate_with_failover(_PROFILE_PROMPT_TEMPLATE.format(name=name), keys)
            profile = _extract_json(resp.text)
            if not _validate_profile(name, profile):
                print(f"[roster_sync] Skipped '{name}' — profile failed validation")
                continue
            profile["auto_generated"] = True
            profile["verified"]       = False
            profile["discovered_at"]  = datetime.now(timezone.utc).isoformat()
            known.append(profile)
            auto_added_names.append(profile["name"])
            added.append(profile["name"])
        except Exception as e:
            print(f"[roster_sync] Error generating profile for '{name}': {e}")

    LIVE_PATH.write_text(json.dumps({
        "hunters":      known,
        "auto_added":   auto_added_names,
        "last_checked": datetime.now(timezone.utc).isoformat(),
    }, indent=2, ensure_ascii=False))

    print(f"[roster_sync] Added {len(added)} new hunter(s): {added or 'none'}")
    return True


async def roster_sync_worker():
    """Runs forever, syncing the hunter roster every INTERVAL seconds."""
    print(f"[roster_sync] Worker started — interval={INTERVAL}s")
    while True:
        try:
            await refresh_hunters()
        except Exception as e:
            print(f"[roster_sync] Unexpected error: {e}")
        await asyncio.sleep(INTERVAL)
