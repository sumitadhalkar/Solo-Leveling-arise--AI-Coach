from app.rag.pipeline import run_coach_pipeline
from app.schemas.coach import CoachRequest


async def get_strategy(request: CoachRequest) -> dict:
    return await run_coach_pipeline(request)
