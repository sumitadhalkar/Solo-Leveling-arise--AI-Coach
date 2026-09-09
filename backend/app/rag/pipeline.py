import asyncio
import hashlib
import json
import re
import time
from collections import Counter, deque
from datetime import datetime, timezone
from pathlib import Path

from cachetools import TTLCache
from google import genai
from google.genai import types
from openai import OpenAI

from app.core.config import settings
from app.schemas.coach import CoachRequest

# ── Response cache — 30-minute TTL, max 500 entries ──────────────────────────
_response_cache: TTLCache = TTLCache(maxsize=500, ttl=1800)

# ── Snapshot path (written by background worker) ──────────────────────────────
_SNAPSHOT_PATH = Path(__file__).parent.parent.parent / "meta_snapshot.json"

# ── Provider pools — Gemini (search-capable) + a generic OpenAI-compatible ───
# ── slot (NVIDIA by default, but any provider speaking that protocol works) ──
# The compat slot has no equivalent to Gemini's live Google Search grounding
# tool — that's a Gemini-specific feature, not something any OpenAI-compatible
# provider offers — so it can only ever serve requests that don't need fresh
# web data. It's a genuinely separate quota pool from Gemini's though, so
# routing ordinary (non-search) generation there first takes real pressure off
# Gemini's tighter, search-capable quota — Gemini stays the fallback if the
# compat slot is unconfigured, cooling down, or erroring.
_gemini_pool: list[tuple[str, genai.Client]] = []   # [(key_str, client), ...]
_compat_pool: list[tuple[str, OpenAI]] = []         # [(key_str, client), ...]
_key_cooldowns: dict[str, float] = {}               # key_str -> monotonic expiry (shared)


def _init_pools():
    global _gemini_pool, _compat_pool
    if not _gemini_pool:
        _gemini_pool = [(k, genai.Client(api_key=k)) for k in settings.gemini_keys()]
    if not _compat_pool:
        base_url = settings.compat_base_url()
        _compat_pool = [(k, OpenAI(api_key=k, base_url=base_url)) for k in settings.compat_keys()]
    if not _gemini_pool and not _compat_pool:
        raise ValueError("No GEMINI_API_KEY or NVIDIA_API_KEY configured in .env")


def _all_keys() -> list[str]:
    return [k for k, _ in _gemini_pool] + [k for k, _ in _compat_pool]


def _model_for(provider: str) -> str:
    return settings.LLM_MODEL if provider == "gemini" else settings.compat_model()


def _pick_candidate(use_search: bool) -> tuple[str, str, object]:
    """Return (provider, key, client) — the configured compat provider first
    for non-search requests, Gemini-only when live search is required."""
    _init_pools()
    now = time.monotonic()

    gemini = sorted((("gemini", k, c) for k, c in _gemini_pool), key=lambda t: _key_cooldowns.get(t[1], 0))
    compat = sorted((("compat", k, c) for k, c in _compat_pool), key=lambda t: _key_cooldowns.get(t[1], 0))

    if use_search:
        # Gemini is strongly preferred (only it can ground on live search), but
        # a compat-only deployment must still degrade to it rather than having
        # every search-needing request fail outright.
        ordered = gemini or compat
    else:
        ordered = (compat + gemini) if compat else gemini

    for cand in ordered:
        if _key_cooldowns.get(cand[1], 0) <= now:
            return cand
    return min(ordered, key=lambda c: _key_cooldowns.get(c[1], 0))


def _mark_rate_limited(key: str, cooldown_s: int = 60):
    _key_cooldowns[key] = time.monotonic() + cooldown_s
    print(f"[ratelimit] Key …{key[-6:]} cooling down for {cooldown_s}s")


def _is_rate_limit(e: Exception) -> bool:
    # Covers both google-genai's message format ("429 RESOURCE_EXHAUSTED...")
    # and the OpenAI SDK's ("Error code: 429 - {'error': {'type': 'rate_limit_exceeded'...")
    msg = str(e).lower()
    return any(kw in msg for kw in (
        "429", "quota", "rate limit", "rate_limit", "resource_exhausted", "rateerror", "too many requests"
    ))


def _is_transient(e: Exception) -> bool:
    """Server-side hiccups worth retrying: model overload, 5xx, timeouts.

    Distinct from _is_rate_limit — a 503 means *the model* is busy, not that our
    key is exhausted, so retrying the same key after a short backoff is the right
    move rather than putting that key into cooldown.
    """
    msg = str(e).lower()
    return any(kw in msg for kw in (
        "503", "unavailable", "overloaded", "high demand", "500", "internal error",
        "502", "504", "deadline", "timeout", "connection reset", "temporarily",
        "connection error", "connect timeout", "service unavailable",
    ))


def _friendly_error(raw: str) -> str:
    """Turn a provider stack-trace string into something a player can act on."""
    low = raw.lower()
    if any(k in low for k in ("503", "unavailable", "overloaded", "high demand")):
        return "The AI model is under heavy load right now. Please try again in a moment."
    if any(k in low for k in ("429", "quota", "rate limit", "resource_exhausted")):
        return "The daily AI request limit has been reached. Please try again later."
    if any(k in low for k in ("api key", "unauthenticated", "permission", "401", "403")):
        return "The AI service is not configured correctly. Please contact the site owner."
    if any(k in low for k in ("deadline", "timeout")):
        return "That request took too long to complete. Please try again."
    return "Something went wrong generating your strategy. Please try again."


# Backoff schedule for transient failures, in seconds between attempts.
_RETRY_BACKOFF = [1.0, 3.0, 7.0]


# ── Analytics ─────────────────────────────────────────────────────────────────
_stats: dict = {
    "cache_hits":         0,
    "cache_misses":       0,
    "search_calls":       0,
    "no_search_calls":    0,
    "json_parse_failures": 0,
    "total_requests":     0,
    "rate_limit_hits":    0,
    "errors":             0,
    "gemini_calls":       0,
    "compat_calls":       0,
}
_timing: dict = {
    "cache_hit": {"ms": 0, "count": 0},
    "no_search": {"ms": 0, "count": 0},
    "search":    {"ms": 0, "count": 0},
}
_char_asks: Counter = Counter()
_request_log: deque = deque(maxlen=200)
_feedback_log: list = []
_feedback_stats: dict = {"up": 0, "down": 0, "regenerates": 0}


def _track_timing(bucket: str, elapsed_ms: int):
    _timing[bucket]["ms"] += elapsed_ms
    _timing[bucket]["count"] += 1


def _avg_ms(bucket: str) -> str:
    c = _timing[bucket]["count"]
    return f"{_timing[bucket]['ms'] // c}ms" if c > 0 else "N/A"


def get_stats() -> dict:
    total = _stats["total_requests"]
    hits  = _stats["cache_hits"]
    return {
        "total_requests":      total,
        "cache_hits":          hits,
        "cache_misses":        _stats["cache_misses"],
        "cache_hit_rate":      f"{hits / total * 100:.1f}%" if total > 0 else "N/A",
        "search_calls":        _stats["search_calls"],
        "no_search_calls":     _stats["no_search_calls"],
        "search_rate":         f"{_stats['search_calls'] / total * 100:.1f}%" if total > 0 else "N/A",
        "json_parse_failures": _stats["json_parse_failures"],
        "rate_limit_hits":     _stats["rate_limit_hits"],
        "errors":              _stats["errors"],
        "provider_calls":      {
            "gemini": _stats["gemini_calls"],
            f"compat ({settings.compat_label()})": _stats["compat_calls"],
        },
        "latency": {
            "cache_hit_avg":  _avg_ms("cache_hit"),
            "no_search_avg":  _avg_ms("no_search"),
            "search_avg":     _avg_ms("search"),
            "targets":        {"cache_hit": "<100ms", "no_search": "<4000ms", "search": "<8000ms"},
        },
        "feedback": {
            "helpful":     _feedback_stats["up"],
            "wrong":       _feedback_stats["down"],
            "regenerates": _feedback_stats["regenerates"],
            "quality_rate": (
                f"{_feedback_stats['up'] / (_feedback_stats['up'] + _feedback_stats['down']) * 100:.1f}%"
                if (_feedback_stats["up"] + _feedback_stats["down"]) > 0 else "N/A"
            ),
        },
        "top_hunters":  _char_asks.most_common(10),
        "cache_size":   len(_response_cache),
        "cache_maxsize": _response_cache.maxsize,
        "recent_requests": list(_request_log)[-20:],
    }


def record_feedback(rating: int, coaching_mode: str, regenerated: bool = False):
    if regenerated:
        _feedback_stats["regenerates"] += 1
    elif rating > 0:
        _feedback_stats["up"] += 1
    elif rating < 0:
        _feedback_stats["down"] += 1
    _feedback_log.append({"ts": time.time(), "rating": rating,
                           "mode": coaching_mode, "regenerated": regenerated})
    if len(_feedback_log) > 500:
        _feedback_log.pop(0)


# ── Cache key ─────────────────────────────────────────────────────────────────

def _cache_key(request: CoachRequest) -> str:
    payload = {
        "game_mode":       request.game_mode,
        "boss":            request.boss,
        "coaching_mode":   request.coaching_mode,
        "spending_level":  request.spending_level,
        "progression_stage": request.progression_stage,
        "question":        request.question,
        "hunters": sorted(
            (h.name, h.advancement, h.weapon, h.weapon_advancement)
            for h in request.hunters
        ),
    }
    return hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()


# ── Robust JSON extraction ────────────────────────────────────────────────────

def _extract_json(text: str) -> dict:
    text = (text or "").strip()
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
    _stats["json_parse_failures"] += 1
    return {"raw_response": text, "parse_error": "Could not extract JSON from response"}


# ── Snapshot utilities ────────────────────────────────────────────────────────

def _snapshot_age_minutes() -> float:
    try:
        snap = json.loads(_SNAPSHOT_PATH.read_text())
        updated = datetime.fromisoformat(snap["last_updated"])
        if updated.tzinfo is None:
            updated = updated.replace(tzinfo=timezone.utc)
        return (datetime.now(timezone.utc) - updated).total_seconds() / 60
    except Exception:
        return float("inf")


def _get_snapshot_confidence() -> float:
    try:
        snap = json.loads(_SNAPSHOT_PATH.read_text())
        return float(snap.get("confidence", 0.0))
    except Exception:
        return 0.0


def _get_snapshot_known_hunters() -> set[str]:
    try:
        snap = json.loads(_SNAPSHOT_PATH.read_text())
        hunters: set[str] = set()
        meta = snap.get("meta_reference", {})
        for key in ("tier_ss", "tier_splus", "tier_s"):
            hunters.update(meta.get(key, []))
        hunters.update(snap.get("authoritative", {}).get("new_hunters", []))
        return hunters
    except Exception:
        return set()


def _load_snapshot() -> str:
    """
    Inject a compact, source-labelled context block into every prompt.
    Source labels tell Gemini exactly how to weight each section.
    """
    try:
        snap = json.loads(_SNAPSHOT_PATH.read_text())
    except Exception:
        return ""

    age_min = _snapshot_age_minutes()
    conf    = snap.get("confidence", 0)
    lines   = [f"LIVE GAME CONTEXT (age: {age_min:.0f} min, confidence: {conf:.0%}):"]

    auth = snap.get("authoritative", {})
    if auth:
        lines.append("\nAUTHORITATIVE — Official Netmarble (treat as facts):")
        if auth.get("patch"):         lines.append(f"  Patch: {auth['patch']}")
        if auth.get("new_hunters"):   lines.append(f"  New Hunters: {', '.join(auth['new_hunters'])}")
        if auth.get("active_banners"):lines.append(f"  Active Banners: {', '.join(auth['active_banners'])}")

    meta = snap.get("meta_reference", {})
    if meta:
        lines.append("\nMETA REFERENCE — arise.tools (community-verified, strong reference):")
        if meta.get("upcoming_banners"): lines.append(f"  Upcoming Banners: {', '.join(meta['upcoming_banners'])}")
        if meta.get("tier_ss"):  lines.append(f"  SS Tier: {', '.join(meta['tier_ss'])}")
        if meta.get("tier_splus"):lines.append(f"  S+ Tier: {', '.join(meta['tier_splus'])}")
        if meta.get("tier_s"):   lines.append(f"  S Tier: {', '.join(meta['tier_s'])}")

    opinion = snap.get("community_opinion", {})
    if opinion.get("hot_topics"):
        lines.append("\nCOMMUNITY OPINION — Reddit (unverified, use as context only — NOT facts):")
        for topic in opinion["hot_topics"][:5]:
            lines.append(f"  • {topic}")

    return "\n".join(lines)


# ── Search suppression ────────────────────────────────────────────────────────

_SEARCH_KEYWORDS = frozenset({
    "patch", "update", "buff", "nerf", "latest", "new hunter",
    "when", "banner", "release", "hotfix", "rework",
})


def _should_search(request: CoachRequest) -> bool:
    """
    True only when live Google Search is genuinely needed.
    Fresh snapshot + stable query → snapshot + Gemini reasoning only.
    """
    if _snapshot_age_minutes() > 45:
        return True
    if _get_snapshot_confidence() < 0.5:
        return True
    if request.coaching_mode == "pull_advisor":
        return True
    q = (request.question or "").lower()
    if any(kw in q for kw in _SEARCH_KEYWORDS):
        return True
    if request.hunters:
        known = _get_snapshot_known_hunters()
        if known and request.hunters[0].name not in known:
            return True
    return False


# ── System prompt ─────────────────────────────────────────────────────────────

_SYSTEM_PROMPT = """\
You are an expert Solo Leveling: ARISE AI Coach — a continuously-updated strategy
advisor that reflects the CURRENT game version, not historical training data.

══════════════════════════════════════════════════
SOURCE PRIORITY  (search in this exact order)
══════════════════════════════════════════════════
1. sololeveling.netmarble.com   — Official patch notes, event notices, announcements
2. forum.netmarble.com/slv_en   — Developer notes, balance changes, roadmaps
3. arise.tools                  — Meta builds, tier lists, artifact optimization,
                                  damage calculators. Treat as highest-authority community source.
4. reddit.com/r/SoloLevelingArise — Community-tested strategies, boss tips, meta discussions
5. solo-leveling-arise.fandom.com — Hunter/boss/artifact/weapon data, accurate skill names
6. game8.co/games/Solo-Leveling-Arise — Boss walkthroughs, tier lists, character builds

Always prefer the NEWEST official source. Never cite sources unrelated to Solo Leveling: ARISE.
Reddit opinions must NEVER be presented as facts — always label them as community sentiment.

══════════════════════════════════════════════════
FEATURE 1 — PATCH-AWARE COACHING
══════════════════════════════════════════════════
• Before every response, confirm the current patch version.
• If any hunter in the roster was recently buffed, nerfed, or reworked, explicitly note it.
• Identify and state the patch version your advice is based on.
• If a new character was released that would help this player, mention it.

══════════════════════════════════════════════════
FEATURE 2 — META vs F2P ADVICE
══════════════════════════════════════════════════
Always provide ALL tiers: Best-in-slot, F2P, Low-invest, Beginner.

══════════════════════════════════════════════════
FEATURE 3 — PROGRESSION STAGE DETECTION
══════════════════════════════════════════════════
Auto-detect stage from Battle Power:
  < 200,000 BP → new | 200k–800k → midgame | 800k–2M → endgame | > 2M → competitive

══════════════════════════════════════════════════
FEATURE 4 — RESOURCE OPTIMIZATION
══════════════════════════════════════════════════
Flag poor-ROI investments. Recommend highest-ROI upgrade path first.
Always include at least one concrete resource-saving tip.

══════════════════════════════════════════════════
FEATURE 5 — TEAM BUILDER
══════════════════════════════════════════════════
Only recommend owned hunters. Identify missing roles per element. Rank gaps by endgame importance.

══════════════════════════════════════════════════
FEATURE 6 — PULL / SUMMON ADVISOR
══════════════════════════════════════════════════
Return: Pull / Soft Pull / Conditional / Skip / Skip (F2P) with explicit reasoning, F2P sustainability,
and separate pros[] and cons[] arrays listing concrete reasons for each side of the decision.
Conditional = worth pulling only under specific roster or resource conditions (explain in reasoning).

══════════════════════════════════════════════════
FEATURE 7 — ARTIFACT OPTIMIZATION
══════════════════════════════════════════════════
For every recommendation: WHY, exact main stat, substat priority, breakpoints, farming location, when it changes.

══════════════════════════════════════════════════
FEATURE 8 — BOSS STRATEGY COACH
══════════════════════════════════════════════════
All attack patterns with tells, elemental weaknesses, exact positioning, skill-timing windows, common mistakes.

══════════════════════════════════════════════════
FEATURE 10 — CONFIDENCE RATINGS
══════════════════════════════════════════════════
confidence: "High" | "Medium" | "Low"
confidence_reason: source used
High = official patch + widely tested | Medium = recent community | Low = theorycrafting/older data

══════════════════════════════════════════════════
FEATURE 11 — MYTH-BUSTING
══════════════════════════════════════════════════
Format: "Myth: [X]. Reality: [Y] because [current patch evidence]."

══════════════════════════════════════════════════
FEATURE 12 — FUTURE PLANNING
══════════════════════════════════════════════════
Short-term (1–2 weeks), Mid-term (1 month), Long-term (2–3 months).

══════════════════════════════════════════════════
FEATURE 14 — BUILD EXPLANATION STANDARD
══════════════════════════════════════════════════
Never recommend without: why, alternatives, when the recommendation changes.

══════════════════════════════════════════════════
FEATURE 15 — META CHANGE TRACKING
══════════════════════════════════════════════════
When ranking a character: current_rank, previous_rank, reason for change.

══════════════════════════════════════════════════
OUTPUT RULES
══════════════════════════════════════════════════
• Return ONLY valid JSON matching the exact schema in the user message.
• No markdown fences, no extra text outside the JSON object.
• All fields required; use null for unused scalars and [] for unused arrays.
• At least 3 rotation steps when relevant. At least 2 mistakes_to_avoid when relevant.
"""

_JSON_SCHEMA = """{
  "patch_version": "string — current game version e.g. '1.6.0'",
  "patch_verified": "string — month/year e.g. 'June 2026'",
  "confidence": "string — 'High', 'Medium', or 'Low'",
  "confidence_reason": "string — source/basis for confidence level",
  "progression_stage_detected": "string — auto-detected or confirmed stage",
  "recommended_team": { "hunters": ["Name1", "Name2", "Name3"], "reasoning": "string" },
  "why": "string — detailed explanation of team choice and elemental synergy",
  "rotation": { "steps": ["1. action", "2. action", "3. action", "4. action"] },
  "f2p_alternative": "string — F2P team or approach",
  "low_invest_alternative": "string — approach needing only 1-2 key units",
  "beginner_alternative": "string — safe approach for brand-new accounts",
  "artifacts_advice": "string — concise artifact summary",
  "artifact_optimization": {
    "best_sets": ["Set Name 1 (reason)"],
    "main_stats": ["Slot: stat"],
    "substats": ["priority 1", "priority 2"],
    "breakpoints": ["breakpoint description"],
    "farming_priority": "string — best farming location",
    "why": "string — WHY this set beats alternatives",
    "alternatives": ["alt set — when to use"],
    "when_recommendation_changes": "string"
  },
  "mistakes_to_avoid": ["mistake 1", "mistake 2"],
  "expected_clear_rate": "X% — qualifier",
  "battle_power_assessment": "string",
  "resource_warnings": [
    { "subject": "name", "warning": "why poor ROI", "alternative": "better use" }
  ],
  "pull_advice": {
    "recommendation": "Pull | Soft Pull | Conditional | Skip | Skip (F2P)",
    "reasoning": "string — 2-3 sentence verdict summary",
    "pros": ["string — concrete reason to pull"],
    "cons": ["string — concrete reason to skip"],
    "alternatives": ["alternative hunter or banner if skipping"],
    "upcoming_banners": ["banner — why it matters"],
    "resource_cost": "string",
    "f2p_verdict": "string"
  },
  "boss_strategy": {
    "attack_patterns": ["pattern with tell"],
    "weaknesses": ["element: reason"],
    "positioning_tips": ["tip"],
    "skill_timing": ["when/how"],
    "common_mistakes": ["mistake and fix"]
  },
  "future_planning": {
    "short_term": ["goal (1-2 weeks)"],
    "mid_term":   ["goal (1 month)"],
    "long_term":  ["goal (2-3 months)"]
  },
  "myths_busted": ["Myth: [claim]. Reality: [correction] because [evidence]."],
  "meta_changes": { "current_rank": "SS|S+|S|A|B", "previous_rank": "SS|S+|S|A|B", "reason": "string" },
  "missing_roles": ["element — missing role"],
  "future_pulls": ["Hunter name — why critical"]
}"""


# ── Stage detection ───────────────────────────────────────────────────────────

def _detect_stage(bp: int, stated: str) -> str:
    if bp == 0:        return stated
    if bp < 200_000:   return "new"
    if bp < 800_000:   return "midgame"
    if bp < 2_000_000: return "endgame"
    return "competitive"


# ── Mode-specific instructions ────────────────────────────────────────────────

def _mode_instruction(request: CoachRequest, detected_stage: str) -> str:
    mode     = request.coaching_mode
    boss     = request.boss or "N/A"
    spending = request.spending_level
    question = request.question or "Not specified"
    base = (f"Focus on {request.game_mode} (boss: {boss}). "
            f"Player is {spending} spending, stage: {detected_stage}.")
    return {
        "strategy": (
            f"{base}\nOptimal team, rotation, artifact advice, BP assessment. "
            "Provide BiS AND F2P/beginner alternatives. Flag poor-ROI investments."
        ),
        "pull_advisor": (
            f"{base}\nPlayer question: {question}\n"
            "Evaluate banner vs roster gaps and meta value. "
            "Return Pull / Soft Pull / Skip / Skip (F2P) with F2P sustainability analysis."
        ),
        "artifact_optimizer": (
            f"{base}\nDeep artifact optimization for main DPS hunters. "
            "WHY, main stats, substats, breakpoints, farming priority, when it changes."
        ),
        "boss_guide": (
            f"{base}\nBoss: {boss}\n"
            "All attack patterns with tells, weaknesses, positioning, skill-timing, common mistakes."
        ),
        "future_planning": (
            f"{base}\nProgression roadmap for {spending}, stage {detected_stage}. "
            "Short-term (1-2 wks), mid-term (1 mo), long-term (2-3 mo)."
        ),
        "myth_bust": (
            f"{base}\nPlayer question: {question}\n"
            "Correct top myths. Format: 'Myth: [X]. Reality: [Y] because [patch evidence].'"
        ),
        "team_builder": (
            f"{base}\n2-3 optimal teams from owned hunters, missing roles per element, "
            "gaps ranked by endgame importance, future pulls for critical gaps, synergy explanation."
        ),
    }.get(mode, base)


# ── Prompt builder ────────────────────────────────────────────────────────────

def _build_prompt(request: CoachRequest) -> str:
    detected_stage = _detect_stage(request.battle_power, request.progression_stage)
    hunter_lines   = "\n".join(
        f"  - {h.name}  A{h.advancement}  Weapon: {h.weapon}+{h.weapon_advancement}  Power: {h.power:,}"
        for h in request.hunters
    ) or "  (no hunters provided)"
    mode_instr      = _mode_instruction(request, detected_stage)
    snapshot_block  = _load_snapshot()
    snapshot_section = f"\n{snapshot_block}\n" if snapshot_block else ""

    return f"""Player Profile
==============
Coaching Mode    : {request.coaching_mode}
Game Mode        : {request.game_mode}
Boss             : {request.boss or "N/A"}
Battle Power     : {request.battle_power:,}
Jin-Woo Power    : {request.jinwoo_power:,}
Spending Level   : {request.spending_level}
Progression Stage: {request.progression_stage} (auto-detected: {detected_stage})
Question         : {request.question or "N/A"}

Owned Hunters:
{hunter_lines}

Blessing Stones : {request.blessing_stones or "none provided"}
Artifacts       : {request.artifacts or "none provided"}
{snapshot_section}
══════════════════════════════════════════════
COACHING TASK
══════════════════════════════════════════════
{mode_instr}

REQUIRED PRE-ANSWER CHECKS:
1. Confirm current patch version.
2. Check if any owned hunter was recently buffed, nerfed, or reworked.
3. Verify current meta for this game mode and boss.
4. Check upcoming banners relevant to this player's gaps.
5. Confirm detected progression stage from battle power.
6. Flag resource warnings for poor-ROI investments.

Return ONLY a valid JSON object matching this exact schema:
{_JSON_SCHEMA}
"""


# ── Sync provider calls (thread executor) — Gemini or the compat slot ────────

def _sync_generate(provider: str, client, model: str, prompt: str, use_search: bool) -> str:
    if provider == "gemini":
        tools = [types.Tool(google_search=types.GoogleSearch())] if use_search else None
        config = types.GenerateContentConfig(system_instruction=_SYSTEM_PROMPT, tools=tools)
        # .text can legitimately be None (safety filtering, empty candidates,
        # a quota response that still returns 200) — never let that propagate
        # as a bare None into _extract_json, which would crash on .strip()
        # with an unhelpful AttributeError that masks the real cause.
        return client.models.generate_content(model=model, contents=prompt, config=config).text or ""

    # The configured OpenAI-compatible provider (NVIDIA by default) — plain
    # chat completions, no search tool available from any provider here.
    resp = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        temperature=0.4,
    )
    return resp.choices[0].message.content or ""


def _sync_stream(provider: str, client, model, prompt, use_search, queue: asyncio.Queue, loop):
    try:
        if provider == "gemini":
            tools = [types.Tool(google_search=types.GoogleSearch())] if use_search else None
            config = types.GenerateContentConfig(system_instruction=_SYSTEM_PROMPT, tools=tools)
            for chunk in client.models.generate_content_stream(model=model, contents=prompt, config=config):
                if chunk.text:
                    loop.call_soon_threadsafe(queue.put_nowait, ("chunk", chunk.text))
        else:
            stream = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": _SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.4,
                stream=True,
            )
            for chunk in stream:
                delta = chunk.choices[0].delta.content if chunk.choices else None
                if delta:
                    loop.call_soon_threadsafe(queue.put_nowait, ("chunk", delta))
    except Exception as e:
        loop.call_soon_threadsafe(queue.put_nowait, ("error", str(e)))
    finally:
        loop.call_soon_threadsafe(queue.put_nowait, ("done", None))


def _log_request(request: CoachRequest, searched: bool, cache_hit: bool, elapsed_ms: int):
    _stats["total_requests"] += 1
    for h in request.hunters:
        _char_asks[h.name] += 1
    _request_log.append({
        "mode":       request.coaching_mode,
        "searched":   searched,
        "cache_hit":  cache_hit,
        "hunters":    [h.name for h in request.hunters[:3]],
        "q_len":      len(request.question or ""),
        "ms":         elapsed_ms,
        "ts":         time.time(),
    })


# ── Main pipeline (non-streaming) ─────────────────────────────────────────────

async def run_coach_pipeline(request: CoachRequest) -> dict:
    t0  = time.monotonic()
    key = _cache_key(request)

    if key in _response_cache:
        _stats["cache_hits"] += 1
        elapsed = int((time.monotonic() - t0) * 1000)
        _track_timing("cache_hit", elapsed)
        _log_request(request, searched=False, cache_hit=True, elapsed_ms=elapsed)
        print(f"[cache] HIT {elapsed}ms — {request.coaching_mode}")
        return _response_cache[key]

    _stats["cache_misses"] += 1
    use_search = _should_search(request)
    prompt     = _build_prompt(request)
    last_error = None

    _init_pools()

    for attempt in range(len(_RETRY_BACKOFF) + 1):
        provider, api_key, client = _pick_candidate(use_search)
        model = _model_for(provider)
        try:
            raw    = await asyncio.to_thread(_sync_generate, provider, client, model, prompt, use_search)
            result = _extract_json(raw)
            if "parse_error" not in result:
                _response_cache[key] = result
            elapsed = int((time.monotonic() - t0) * 1000)
            bucket  = "search" if use_search else "no_search"
            _track_timing(bucket, elapsed)
            if use_search: _stats["search_calls"] += 1
            else:          _stats["no_search_calls"] += 1
            _stats[f"{provider}_calls"] = _stats.get(f"{provider}_calls", 0) + 1
            _log_request(request, searched=use_search, cache_hit=False, elapsed_ms=elapsed)
            label = provider if provider == "gemini" else f"compat:{settings.compat_label()}"
            print(f"[pipeline] {elapsed}ms  provider={label}  model={model}  search={use_search}  key=…{api_key[-6:]}")
            return result
        except Exception as e:
            last_error = e
            retryable  = _is_transient(e) or _is_rate_limit(e)

            if _is_rate_limit(e):
                _stats["rate_limit_hits"] += 1
                _mark_rate_limited(api_key)

            if attempt >= len(_RETRY_BACKOFF) or not retryable:
                break

            # A different key (possibly a different provider) already free? Switch without waiting.
            now = time.monotonic()
            key_available = any(_key_cooldowns.get(k, 0) <= now for k in _all_keys())
            delay = 0.0 if (_is_rate_limit(e) and key_available) else _RETRY_BACKOFF[attempt]

            print(f"[retry] attempt {attempt + 1} ({provider}) failed ({str(e)[:100]}) — retrying in {delay}s")
            if delay:
                await asyncio.sleep(delay)

    _stats["errors"] = _stats.get("errors", 0) + 1
    return {
        "raw_response": str(last_error),
        "parse_error":  "All models/keys failed",
        "error":        _friendly_error(str(last_error)),
    }


# ── Streaming pipeline ────────────────────────────────────────────────────────

async def _drain_stream_once(provider, client, model, prompt, use_search):
    """Run one streaming attempt.

    Text is accumulated rather than forwarded so that a failure arriving before
    any output can be retried cleanly — once we have started emitting to the
    client, replaying a fresh attempt would duplicate content.

    Returns (chunks, error_message_or_None).
    """
    loop = asyncio.get_running_loop()
    queue: asyncio.Queue = asyncio.Queue()
    loop.run_in_executor(None, _sync_stream, provider, client, model, prompt, use_search, queue, loop)

    chunks: list[str] = []
    error = None
    while True:
        kind, value = await queue.get()
        if kind == "chunk":
            chunks.append(value)
        elif kind == "error":
            error = value
        elif kind == "done":
            break
    return chunks, error


async def run_coach_pipeline_stream(request: CoachRequest):
    t0 = time.monotonic()
    key = _cache_key(request)

    if key in _response_cache:
        _stats["cache_hits"] += 1
        elapsed = int((time.monotonic() - t0) * 1000)
        _track_timing("cache_hit", elapsed)
        _log_request(request, searched=False, cache_hit=True, elapsed_ms=elapsed)
        print(f"[cache] HIT (stream) {elapsed}ms")
        yield f"data: {json.dumps({'type': 'result', 'data': _response_cache[key]})}\n\n"
        return

    _stats["cache_misses"] += 1
    use_search = _should_search(request)
    prompt = _build_prompt(request)

    _init_pools()
    chunks: list[str] = []
    last_error = None
    last_provider = None

    # Retry transient model overloads with backoff, and fail over to another
    # key — possibly a different provider — on rate limits.
    for attempt in range(len(_RETRY_BACKOFF) + 1):
        provider, api_key, client = _pick_candidate(use_search)
        last_provider = provider
        model = _model_for(provider)
        chunks, err = await _drain_stream_once(provider, client, model, prompt, use_search)

        if err is None:
            last_error = None
            break

        last_error = err
        exc = Exception(err)
        retryable = _is_transient(exc) or _is_rate_limit(exc)

        if _is_rate_limit(exc):
            _stats["rate_limit_hits"] += 1
            _mark_rate_limited(api_key)

        if attempt >= len(_RETRY_BACKOFF) or not retryable:
            break

        # If a different key (possibly a different provider) is already free, switch without waiting.
        now = time.monotonic()
        key_available = any(_key_cooldowns.get(k, 0) <= now for k in _all_keys())
        delay = 0.0 if (_is_rate_limit(exc) and key_available) else _RETRY_BACKOFF[attempt]

        print(f"[retry] attempt {attempt + 1} ({provider}) failed ({err[:100]}) — retrying in {delay}s")
        yield f"data: {json.dumps({'type': 'status', 'message': 'Model busy - retrying...'})}\n\n"
        if delay:
            await asyncio.sleep(delay)

    if last_error is not None:
        _stats["errors"] = _stats.get("errors", 0) + 1
        print(f"[pipeline] stream FAILED after retries: {last_error[:200]}")
        yield f"data: {json.dumps({'type': 'error', 'message': _friendly_error(last_error)})}\n\n"
        return

    # Replay the buffered text so the client still gets incremental output.
    for chunk in chunks:
        yield f"data: {json.dumps({'type': 'chunk', 'text': chunk})}\n\n"

    result = _extract_json("".join(chunks))
    elapsed = int((time.monotonic() - t0) * 1000)
    bucket = "search" if use_search else "no_search"
    _track_timing(bucket, elapsed)
    if use_search:
        _stats["search_calls"] += 1
    else:
        _stats["no_search_calls"] += 1
    _stats[f"{last_provider}_calls"] = _stats.get(f"{last_provider}_calls", 0) + 1
    _log_request(request, searched=use_search, cache_hit=False, elapsed_ms=elapsed)
    if "parse_error" not in result:
        _response_cache[key] = result
    label = last_provider if last_provider == "gemini" else f"compat:{settings.compat_label()}"
    print(f"[pipeline] stream {elapsed}ms  provider={label}  search={use_search}")
    yield f"data: {json.dumps({'type': 'result', 'data': result})}\n\n"
