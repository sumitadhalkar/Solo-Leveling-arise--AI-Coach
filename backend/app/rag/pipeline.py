import itertools
import json

from google import genai
from google.genai import types

from app.core.config import settings
from app.schemas.coach import CoachRequest

_clients: list[genai.Client] = []
_client_cycle = None

# ── System prompt ────────────────────────────────────────────────────────────

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

══════════════════════════════════════════════════
FEATURE 1 — PATCH-AWARE COACHING
══════════════════════════════════════════════════
• Before every response, search official Netmarble sources for the current patch version.
• If any hunter in the roster was recently buffed, nerfed, or reworked, explicitly note it.
• Identify and state the patch version your advice is based on.
• If a new character was released that would help this player, mention it.

══════════════════════════════════════════════════
FEATURE 2 — META vs F2P ADVICE
══════════════════════════════════════════════════
Always provide ALL of the following tiers:
• Best-in-slot (BiS) — optimal regardless of cost
• F2P alternative   — using only free resources
• Low-invest alternative — minimal pulls / one key unit
• Beginner alternative  — safe for brand-new accounts

══════════════════════════════════════════════════
FEATURE 3 — PROGRESSION STAGE DETECTION
══════════════════════════════════════════════════
Auto-detect stage from Battle Power if not explicitly stated:
  < 200,000 BP        → new account
  200,000–800,000 BP  → midgame
  800,000–2,000,000 BP → endgame
  > 2,000,000 BP      → competitive
Tailor ALL advice to the detected stage:
• new         → story prog, element coverage, reroll targets
• midgame     → team synergy, specialist element teams
• endgame     → Guild Boss scoring, Palace of Darkness, Workshop of Brilliant Light
• competitive → top-1% rotations, exact artifact breakpoints, frame-perfect timing

══════════════════════════════════════════════════
FEATURE 4 — RESOURCE OPTIMIZATION
══════════════════════════════════════════════════
• Flag any investment (character, weapon, artifact, skill) with poor long-term ROI.
• Warn about power-crept characters or near-deprecated artifacts before the player commits.
• Always recommend the highest-ROI upgrade path FIRST.
• Provide at least one concrete resource-saving tip per response.

══════════════════════════════════════════════════
FEATURE 5 — TEAM BUILDER
══════════════════════════════════════════════════
• Only recommend hunters the player actually owns.
• Build multiple teams covering different elements.
• Identify missing roles (DPS / Breaker / Supporter) per element.
• Rank gaps by importance for endgame content.
• Recommend specific future pulls to fill critical gaps.

══════════════════════════════════════════════════
FEATURE 6 — PULL / SUMMON ADVISOR
══════════════════════════════════════════════════
Evaluate banners by:
• Current meta value of the character
• Account gaps vs existing roster
• Upcoming banners (check official sources)
• F2P resource cost and sustainability
Return: Pull / Soft Pull / Skip / Skip (F2P) with explicit reasoning.

══════════════════════════════════════════════════
FEATURE 7 — ARTIFACT OPTIMIZATION
══════════════════════════════════════════════════
For every artifact recommendation, explain:
• WHY this set is recommended over alternatives
• Exact main stat priority per slot
• Substat priority order
• Breakpoints to hit before diminishing returns
• Farming location with highest efficiency
• When this recommendation changes (new boss, upcoming patch, alternative comp)

══════════════════════════════════════════════════
FEATURE 8 — BOSS STRATEGY COACH
══════════════════════════════════════════════════
For every boss, provide:
• All notable attack patterns with readable tells
• Elemental weaknesses and resistances
• Exact positioning tips
• Critical skill-timing windows
• Most common player mistakes and how to avoid them

══════════════════════════════════════════════════
FEATURE 10 — CONFIDENCE RATINGS
══════════════════════════════════════════════════
Every recommendation MUST include:
• confidence: "High" | "Medium" | "Low"
• confidence_reason: source used (official patch, community testing, theorycrafting, etc.)
  High   = official patch notes + widely community-tested
  Medium = recent community testing or limited sample
  Low    = theorycrafting, older data, or conflicting sources

══════════════════════════════════════════════════
FEATURE 11 — MYTH-BUSTING
══════════════════════════════════════════════════
• Correct common outdated or inaccurate community beliefs.
• Always explain WHY a myth is wrong, citing the current patch.
• Format: "Myth: [X]. Reality: [Y] because [reason]."

══════════════════════════════════════════════════
FEATURE 12 — FUTURE PLANNING
══════════════════════════════════════════════════
Always provide a progression roadmap:
• Short-term (1–2 weeks): immediate wins, quick upgrades
• Mid-term (1 month): resource targets, team investments
• Long-term (2–3 months): endgame prep, meta positioning
Scale depth to the player's spending level and progression stage.

══════════════════════════════════════════════════
FEATURE 13 — WEB SEARCH HIERARCHY
══════════════════════════════════════════════════
Already defined in Source Priority above.
If official and community sources conflict, always prefer the NEWER official source.

══════════════════════════════════════════════════
FEATURE 14 — BUILD EXPLANATION STANDARD
══════════════════════════════════════════════════
Never say "use X artifact" without explaining:
• Why it is recommended over alternatives
• What alternatives exist and when to use them
• When the recommendation changes

══════════════════════════════════════════════════
FEATURE 15 — META CHANGE TRACKING
══════════════════════════════════════════════════
When ranking a character, always state:
• current_rank  (e.g. "SS")
• previous_rank (e.g. "S+")
• reason        (buff, nerf, power-crept, new synergy discovered, etc.)

══════════════════════════════════════════════════
OUTPUT RULES
══════════════════════════════════════════════════
• Return ONLY valid JSON matching the exact schema in the user message.
• No markdown fences, no extra text outside the JSON object.
• All fields required; use null for unused scalars and [] for unused arrays.
• All string values must be complete, informative sentences — never placeholders.
• Provide at least 3 rotation steps when rotation is relevant.
• Provide at least 2 mistakes_to_avoid when strategy is relevant.
"""

# ── Client pool ──────────────────────────────────────────────────────────────

def _get_next_client() -> genai.Client:
    global _clients, _client_cycle
    if not _clients:
        keys = [k for k in [settings.GEMINI_API_KEY, settings.GEMINI_API_KEY_2] if k]
        if not keys:
            raise ValueError("No GEMINI_API_KEY configured in .env")
        _clients = [genai.Client(api_key=k) for k in keys]
        _client_cycle = itertools.cycle(_clients)
    return next(_client_cycle)


# ── Stage detection ───────────────────────────────────────────────────────────

def _detect_stage(bp: int, stated: str) -> str:
    if bp == 0:
        return stated
    if bp < 200_000:
        return "new"
    if bp < 800_000:
        return "midgame"
    if bp < 2_000_000:
        return "endgame"
    return "competitive"


# ── Mode-specific instructions ────────────────────────────────────────────────

def _mode_instruction(request: CoachRequest, detected_stage: str) -> str:
    mode = request.coaching_mode
    boss = request.boss or "N/A"
    game_mode = request.game_mode
    spending = request.spending_level
    question = request.question or "Not specified"

    base = (
        f"Search priority sources for the latest information on {game_mode} "
        f"(boss: {boss}). Player is {spending} spending, stage: {detected_stage}."
    )

    instructions = {
        "strategy": (
            f"{base}\n"
            "Focus: optimal team composition from owned hunters, step-by-step rotation, "
            "artifact advice, battle-power assessment. Provide BiS AND F2P/beginner "
            "alternatives. Flag resource warnings for any poor-ROI investments in roster."
        ),
        "pull_advisor": (
            f"{base}\n"
            f"Player question: {question}\n"
            "Evaluate the current/upcoming banner against their roster gaps and meta value. "
            "Check official sources for upcoming banners. Return a clear Pull / Soft Pull / "
            "Skip / Skip (F2P) verdict with full reasoning. Include F2P sustainability analysis."
        ),
        "artifact_optimizer": (
            f"{base}\n"
            "Provide a deep artifact optimization guide for the player's main DPS hunters. "
            "For each set, explain WHY over alternatives, exact main stats, substat priority, "
            "breakpoints, farming priority, and when the recommendation changes."
        ),
        "boss_guide": (
            f"{base}\n"
            f"Boss: {boss}\n"
            "Provide a comprehensive boss strategy: all attack patterns with tells, "
            "elemental weaknesses/resistances, exact positioning, critical skill-timing "
            "windows, and the most common mistakes players make."
        ),
        "future_planning": (
            f"{base}\n"
            "Build a structured progression roadmap tailored to this player's roster, "
            f"spending level ({spending}), and stage ({detected_stage}). "
            "Short-term (1–2 weeks), mid-term (1 month), long-term (2–3 months)."
        ),
        "myth_bust": (
            f"{base}\n"
            f"Player question: {question}\n"
            "Identify and correct top myths/misconceptions related to this question. "
            "Format each as 'Myth: [X]. Reality: [Y] because [current patch evidence].'"
        ),
        "team_builder": (
            f"{base}\n"
            "Full roster analysis: build 2–3 optimal teams from owned hunters, identify "
            "missing roles per element (DPS/Breaker/Supporter), rank gaps by endgame "
            "importance, recommend specific future pulls to fill critical gaps, "
            "and explain the synergy behind each team."
        ),
    }
    return instructions.get(mode, base)


# ── JSON schema template ──────────────────────────────────────────────────────

_JSON_SCHEMA = """{
  "patch_version": "string — current game version e.g. '1.6.0' or 'June 2026 update'",
  "patch_verified": "string — month/year of the patch check e.g. 'June 2026'",
  "confidence": "string — 'High', 'Medium', or 'Low'",
  "confidence_reason": "string — source/basis for confidence level",
  "progression_stage_detected": "string — auto-detected or confirmed stage",

  "recommended_team": {
    "hunters": ["Name1", "Name2", "Name3"],
    "reasoning": "string — why this specific trio from the player's roster"
  },
  "why": "string — detailed explanation of team choice and elemental synergy",
  "rotation": {
    "steps": ["1. action", "2. action", "3. action", "4. action"]
  },

  "f2p_alternative": "string — F2P team or approach (no gacha required)",
  "low_invest_alternative": "string — approach needing only 1–2 key units",
  "beginner_alternative": "string — safe approach for brand-new accounts",

  "artifacts_advice": "string — concise artifact summary",
  "artifact_optimization": {
    "best_sets": ["Set Name 1 (reason)", "Set Name 2 (reason)"],
    "main_stats": ["Slot: stat", "Slot: stat"],
    "substats": ["priority 1", "priority 2", "priority 3"],
    "breakpoints": ["breakpoint description"],
    "farming_priority": "string — best farming location and efficiency",
    "why": "string — WHY this set beats alternatives for this specific hunter/content",
    "alternatives": ["alt set 1 — when to use", "alt set 2 — when to use"],
    "when_recommendation_changes": "string — conditions that would shift this advice"
  },

  "mistakes_to_avoid": [
    "mistake description 1",
    "mistake description 2"
  ],
  "expected_clear_rate": "X% — with brief qualifier",
  "battle_power_assessment": "string — analysis of whether BP is sufficient",

  "resource_warnings": [
    {
      "subject": "hunter/item name",
      "warning": "why this investment has poor long-term value",
      "alternative": "better use of the same resources"
    }
  ],

  "pull_advice": {
    "recommendation": "Pull | Soft Pull | Skip | Skip (F2P)",
    "reasoning": "string — full reasoning for the verdict",
    "upcoming_banners": ["banner name — why it matters"],
    "resource_cost": "string — estimated Essence Stones / pulls required",
    "f2p_verdict": "string — specific advice for F2P players"
  },

  "boss_strategy": {
    "attack_patterns": ["pattern with readable tell"],
    "weaknesses": ["element: reason"],
    "positioning_tips": ["tip"],
    "skill_timing": ["when/how to use which skill"],
    "common_mistakes": ["mistake and how to avoid it"]
  },

  "future_planning": {
    "short_term": ["goal 1 (1-2 weeks)", "goal 2"],
    "mid_term": ["goal 1 (1 month)", "goal 2"],
    "long_term": ["goal 1 (2-3 months)", "goal 2"]
  },

  "myths_busted": [
    "Myth: [claim]. Reality: [correction] because [current patch evidence]."
  ],

  "meta_changes": {
    "current_rank": "SS | S+ | S | A | B",
    "previous_rank": "SS | S+ | S | A | B",
    "reason": "string — what caused the rank change"
  },

  "missing_roles": ["element — missing role (e.g. Fire — Breaker)"],
  "future_pulls": ["Hunter name — reason this fills a critical gap"]
}"""


# ── Prompt builder ────────────────────────────────────────────────────────────

def _build_prompt(request: CoachRequest) -> str:
    detected_stage = _detect_stage(request.battle_power, request.progression_stage)

    hunter_lines = "\n".join(
        f"  - {h.name}  A{h.advancement}  Weapon: {h.weapon}+{h.weapon_advancement}"
        f"  Power: {h.power:,}"
        for h in request.hunters
    ) or "  (no hunters provided)"

    mode_instr = _mode_instruction(request, detected_stage)

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

══════════════════════════════════════════════
COACHING TASK
══════════════════════════════════════════════
{mode_instr}

REQUIRED PRE-ANSWER CHECKS:
1. Search official Netmarble sources — confirm current patch version.
2. Check if any owned hunter was recently buffed, nerfed, or reworked.
3. Verify the current meta for this game mode and boss.
4. Check for upcoming banners relevant to this player's gaps.
5. Confirm detected progression stage from battle power.
6. Flag any resource warnings for poor-ROI investments in the roster.

Return ONLY a valid JSON object matching this exact schema:
{_JSON_SCHEMA}
"""


# ── Main pipeline ─────────────────────────────────────────────────────────────

async def run_coach_pipeline(request: CoachRequest) -> dict:
    client = _get_next_client()
    prompt = _build_prompt(request)
    config = types.GenerateContentConfig(
        system_instruction=_SYSTEM_PROMPT,
        tools=[types.Tool(google_search=types.GoogleSearch())],
    )

    models_to_try = [settings.LLM_MODEL, "gemini-2.0-flash"]
    last_error = None

    for model in models_to_try:
        try:
            response = client.models.generate_content(
                model=model, contents=prompt, config=config,
            )
            raw = response.text.strip()
            # Strip markdown fences if present
            if raw.startswith("```"):
                parts = raw.split("```")
                raw = parts[1] if len(parts) > 1 else raw
                if raw.startswith("json"):
                    raw = raw[4:]
                raw = raw.strip()
            try:
                return json.loads(raw)
            except json.JSONDecodeError:
                return {"raw_response": raw, "parse_error": "LLM did not return valid JSON"}
        except Exception as e:
            last_error = e
            continue

    return {"raw_response": str(last_error), "parse_error": "All models failed"}
