"""
Background worker: refreshes meta_snapshot.json every 30 minutes.
Sources are explicitly weighted — Netmarble is authoritative, arise.tools is
meta reference, Reddit is community opinion only. The snapshot is kept compact
(no full patch notes, no history) so injecting it into every prompt is cheap.

Deliberately Gemini-only: this worker's whole job is grounding on live Google
Search results, and NVIDIA's OpenAI-compatible endpoint (used elsewhere in the
pipeline for ordinary generation, see app/rag/pipeline.py) has no equivalent
search-grounding tool. There's nothing to fail over to here.
"""
import asyncio
import json
import re
from datetime import datetime, timezone
from pathlib import Path

from google import genai
from google.genai import types

from app.core.config import settings

SNAPSHOT_PATH = Path(__file__).parent.parent.parent / "meta_snapshot.json"
INTERVAL = 1800  # 30 minutes

# ── Prompt instructs Gemini to source-weight correctly ────────────────────────
_PROMPT = """\
Search these sources for Solo Leveling: ARISE and return ONLY a valid JSON object
(no markdown fences, no prose outside the JSON).

SOURCE RULES — apply these strictly:
• authoritative  → search sololeveling.netmarble.com ONLY (official facts)
• meta_reference → search arise.tools ONLY (community-verified builds/tiers)
• community_opinion → search reddit.com/r/SoloLevelingArise ONLY (opinions, NOT facts)

Return this compact structure (no patch notes text, no history, no extra fields):
{
  "authoritative": {
    "patch": "current official patch version string e.g. '2.1.0'",
    "new_hunters": ["officially released hunter names from last 2 patches only"],
    "active_banners": ["currently active official banner names only"]
  },
  "meta_reference": {
    "upcoming_banners": ["confirmed upcoming banner names from arise.tools"],
    "tier_ss": ["SS-tier hunter names from arise.tools tier list"],
    "tier_splus": ["S+-tier hunter names"],
    "tier_s": ["S-tier hunter names"]
  },
  "community_opinion": {
    "hot_topics": [
      "brief topic summary — 10 words max, 5 topics max"
    ]
  }
}

IMPORTANT:
- Do NOT mix sources — only Netmarble facts in authoritative, only arise.tools in meta_reference.
- Keep all arrays short (max 8 items each).
- hot_topics must be brief summaries, NOT quotes or long sentences.
- If a source is unavailable, use an empty array/string for that section.
"""


def _compute_confidence(data: dict) -> float:
    """Score 0–1 based on which sections were successfully populated."""
    score = 0.0
    auth = data.get("authoritative", {})
    meta = data.get("meta_reference", {})
    if auth.get("patch"):            score += 0.30
    if auth.get("new_hunters"):      score += 0.20
    if auth.get("active_banners"):   score += 0.10
    if meta.get("tier_ss"):          score += 0.25
    if meta.get("upcoming_banners"): score += 0.15
    return round(score, 2)


def _extract_json(text: str) -> dict:
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
    return {}


async def refresh_snapshot() -> bool:
    keys = settings.gemini_keys()
    if not keys:
        return False

    config = types.GenerateContentConfig(
        tools=[types.Tool(google_search=types.GoogleSearch())]
    )

    def _call(client: genai.Client):
        return client.models.generate_content(
            model=settings.LLM_MODEL,
            contents=_PROMPT,
            config=config,
        )

    # Any number of keys may be configured (comma-separated in either
    # GEMINI_API_KEY or GEMINI_API_KEY_2) — try each in turn rather than
    # giving up after the first, so a rate-limited key doesn't stall every
    # refresh cycle when other keys are available.
    last_error = None
    for i, key in enumerate(keys):
        try:
            client = genai.Client(api_key=key)
            response = await asyncio.to_thread(_call, client)
            data = _extract_json(response.text)
            if not data:
                print(f"[snapshot] Empty response (key …{key[-6:]}) — skipping write")
                return False

            # Enforce compactness — truncate oversized arrays
            for section in ("tier_ss", "tier_splus", "tier_s", "upcoming_banners"):
                meta = data.get("meta_reference", {})
                if isinstance(meta.get(section), list):
                    meta[section] = meta[section][:8]
            if isinstance(data.get("community_opinion", {}).get("hot_topics"), list):
                data["community_opinion"]["hot_topics"] = \
                    data["community_opinion"]["hot_topics"][:5]

            data["last_updated"] = datetime.now(timezone.utc).isoformat()
            data["confidence"]   = _compute_confidence(data)

            SNAPSHOT_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False))

            auth = data.get("authoritative", {})
            print(
                f"[snapshot] Updated — patch={auth.get('patch', '?')}  "
                f"confidence={data['confidence']:.0%}  "
                f"size={len(SNAPSHOT_PATH.read_bytes())}B  key=…{key[-6:]}"
            )
            return True

        except Exception as e:
            last_error = e
            print(f"[snapshot] Key …{key[-6:]} failed ({e}) — "
                  f"{'trying next key' if i + 1 < len(keys) else 'no keys left'}")

    print(f"[snapshot] All {len(keys)} key(s) failed — last error: {last_error}")
    return False


async def snapshot_worker():
    """Runs forever, refreshing meta_snapshot.json every INTERVAL seconds."""
    print(f"[snapshot] Worker started — interval={INTERVAL}s")
    while True:
        await refresh_snapshot()
        await asyncio.sleep(INTERVAL)
