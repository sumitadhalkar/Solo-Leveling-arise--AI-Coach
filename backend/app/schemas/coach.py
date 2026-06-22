from typing import List, Optional

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

    @field_validator('jinwoo_power', 'battle_power', mode='before')
    @classmethod
    def coerce_to_int(cls, v):
        return int(float(v)) if v is not None else 0


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
