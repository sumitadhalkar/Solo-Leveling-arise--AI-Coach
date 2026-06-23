from typing import List, Literal, Optional

from pydantic import BaseModel, field_validator


class HunterInput(BaseModel):
    name: str
    advancement: int = 0
    weapon: str = "R"
    weapon_advancement: int = 0
    power: int = 0

    @field_validator('power', 'advancement', 'weapon_advancement', mode='before')
    @classmethod
    def coerce_to_int(cls, v):
        return int(float(v)) if v is not None else 0


class CoachRequest(BaseModel):
    game_mode: str
    boss: Optional[str] = None
    jinwoo_power: int = 0
    hunters: List[HunterInput]
    artifacts: List[dict] = []
    blessing_stones: List[dict] = []
    battle_power: int = 0

    # Feature 2 – spending tier
    spending_level: Literal["f2p", "low", "moderate", "whale"] = "f2p"
    # Feature 3 – progression stage (auto-detected or explicit)
    progression_stage: Literal["new", "midgame", "endgame", "competitive"] = "midgame"
    # Feature 5/6/7/8/11/12 – coaching mode
    coaching_mode: Literal[
        "strategy", "pull_advisor", "artifact_optimizer",
        "boss_guide", "future_planning", "myth_bust", "team_builder"
    ] = "strategy"
    # Free-text question (pull_advisor / myth_bust)
    question: Optional[str] = None

    @field_validator('jinwoo_power', 'battle_power', mode='before')
    @classmethod
    def coerce_to_int(cls, v):
        return int(float(v)) if v is not None else 0


# ── Response sub-models ──────────────────────────────────────────────────────

class TeamRecommendation(BaseModel):
    hunters: List[str]
    reasoning: str


class Rotation(BaseModel):
    steps: List[str]


class MetaChange(BaseModel):
    current_rank: str
    previous_rank: str
    reason: str


class ResourceWarning(BaseModel):
    subject: str
    warning: str
    alternative: str


class BossStrategy(BaseModel):
    attack_patterns: List[str]
    weaknesses: List[str]
    positioning_tips: List[str]
    skill_timing: List[str]
    common_mistakes: List[str]


class ArtifactOptimization(BaseModel):
    best_sets: List[str]
    main_stats: List[str]
    substats: List[str]
    breakpoints: List[str]
    farming_priority: str
    why: str
    alternatives: List[str]
    when_recommendation_changes: str


class PullAdvice(BaseModel):
    recommendation: str          # "Pull" | "Skip" | "Soft Pull" | "Skip (F2P)"
    reasoning: str
    upcoming_banners: List[str]
    resource_cost: str
    f2p_verdict: str


class FuturePlanning(BaseModel):
    short_term: List[str]
    mid_term: List[str]
    long_term: List[str]


class CoachResponse(BaseModel):
    # ── Core strategy ──
    recommended_team: Optional[TeamRecommendation] = None
    why: Optional[str] = None
    rotation: Optional[Rotation] = None

    # ── Gear (quick + detailed) ──
    artifacts_advice: Optional[str] = None
    artifact_optimization: Optional[ArtifactOptimization] = None

    # ── Avoidance ──
    mistakes_to_avoid: List[str] = []

    # ── Assessment ──
    expected_clear_rate: Optional[str] = None
    battle_power_assessment: Optional[str] = None

    # ── Feature 1: Patch awareness ──
    patch_version: Optional[str] = None
    patch_verified: Optional[str] = None

    # ── Feature 2: Spending tiers ──
    f2p_alternative: Optional[str] = None
    low_invest_alternative: Optional[str] = None
    beginner_alternative: Optional[str] = None

    # ── Feature 3: Progression stage ──
    progression_stage_detected: Optional[str] = None

    # ── Feature 4: Resource warnings ──
    resource_warnings: List[ResourceWarning] = []

    # ── Feature 6: Pull advice ──
    pull_advice: Optional[PullAdvice] = None

    # ── Feature 7: Artifact optimization (detailed) ──
    # (uses artifact_optimization above)

    # ── Feature 8: Boss strategy ──
    boss_strategy: Optional[BossStrategy] = None

    # ── Feature 10: Confidence rating ──
    confidence: Optional[str] = None          # "High" | "Medium" | "Low"
    confidence_reason: Optional[str] = None

    # ── Feature 11: Myth busting ──
    myths_busted: List[str] = []

    # ── Feature 12: Future planning ──
    future_planning: Optional[FuturePlanning] = None

    # ── Feature 15: Meta change tracking ──
    meta_changes: Optional[MetaChange] = None

    # ── Feature 5: Team builder extras ──
    missing_roles: List[str] = []
    future_pulls: List[str] = []
