import itertools
import json

from google import genai
from google.genai import types

from app.core.config import settings
from app.schemas.coach import CoachRequest

_clients: list[genai.Client] = []
_client_cycle = None

_SYSTEM_PROMPT = """\
You are an expert Solo Leveling: ARISE AI Coach. You analyze a player's exact roster,
artifacts, and game context to deliver personalized, mode-specific strategy advice.

Source Priority (always follow this order when searching the web):
1. arise.tools                     — meta builds, team guides, artifact optimization,
                                     tier lists, damage calculators. HIGHEST PRIORITY.
2. reddit.com/r/SoloLevelingArise  — real player strategies, boss tips, community-tested
                                     team compositions, current meta discussions.
3. solo-leveling-arise.fandom.com  — structured hunter/boss/artifact/weapon data,
                                     accurate skill names, mechanics, stats.
4. sololeveling.netmarble.com      — official patch notes and balance changes only.
                                     Use to verify advice is current after patches.
5. game8.co/games/Solo-Leveling-Arise — boss walkthroughs, tier lists, character builds.

Always search these sites first before any other source. If arise.tools or Reddit
community advice conflicts with older wiki entries, prefer the more recent
community-tested information. Never cite sources not related to Solo Leveling: ARISE.

Strategy Rules:
- Only recommend hunters the player actually owns.
- Always explain elemental weaknesses and mechanical synergies.
- Rotations must be concrete step-by-step sequences, not generic advice.
- Return ONLY valid JSON matching the structure in the user message — no markdown fences, no extra text.
"""


def _get_next_client() -> genai.Client:
    global _clients, _client_cycle
    if not _clients:
        keys = [k for k in [settings.GEMINI_API_KEY, settings.GEMINI_API_KEY_2] if k]
        if not keys:
            raise ValueError("No GEMINI_API_KEY configured in .env")
        _clients = [genai.Client(api_key=k) for k in keys]
        _client_cycle = itertools.cycle(_clients)
    return next(_client_cycle)


def _build_prompt(request: CoachRequest) -> str:
    hunter_lines = "\n".join(
        f"  - {h.name}  A{h.advancement}  Weapon: {h.weapon}+{h.weapon_advancement}  Power: {h.power:,}"
        for h in request.hunters
    )

    return f"""Player Situation
================
Game Mode   : {request.game_mode}
Boss        : {request.boss or "N/A"}
Battle Power: {request.battle_power:,}
Jin-Woo Power: {request.jinwoo_power:,}

Hunter Roster:
{hunter_lines}

Blessing Stones : {request.blessing_stones or "none provided"}
Artifacts       : {request.artifacts or "none provided"}

Task
====
Search the priority sources for up-to-date guides on this boss and game mode,
then return a JSON object with exactly these keys:
{{
  "recommended_team": {{"hunters": ["Name1", "Name2", "Name3"], "reasoning": "..."}},
  "why": "...",
  "rotation": {{"steps": ["1. ...", "2. ...", "3. ..."]}},
  "artifacts_advice": "...",
  "mistakes_to_avoid": ["...", "..."],
  "expected_clear_rate": "X%",
  "battle_power_assessment": "..."
}}
"""


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
            if raw.startswith("```"):
                raw = raw.split("```")[1]
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
