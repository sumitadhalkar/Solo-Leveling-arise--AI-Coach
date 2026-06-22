from typing import List, Optional

from pydantic import BaseModel


class HunterInput(BaseModel):
    name: str
    advancement: int = 0        # A0–A10
    weapon: str = "R"           # R, SR, SSR
    weapon_advancement: int = 0
    power: int = 0


class CoachRequest(BaseModel):
    game_mode: str
    boss: Optional[str] = None
    jinwoo_power: int = 0
    hunters: List[HunterInput]
    artifacts: List[dict] = []
    blessing_stones: List[dict] = []
    battle_power: int = 0


class TeamRecommendation(BaseModel):
    hunters: List[str]
    reasoning: str


class Rotation(BaseModel):
    steps: List[str]


class CoachResponse(BaseModel):
    recommended_team: TeamRecommendation
    why: str
    rotation: Rotation
    artifacts_advice: str
    mistakes_to_avoid: List[str]
    expected_clear_rate: str
    battle_power_assessment: str
