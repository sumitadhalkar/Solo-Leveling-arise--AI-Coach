from app.rag.pipeline import (
    get_stats as _get_stats,
    record_feedback as _record_feedback,
    run_coach_pipeline,
    run_coach_pipeline_stream,
)
from app.schemas.coach import CoachRequest


async def get_strategy(request: CoachRequest) -> dict:
    return await run_coach_pipeline(request)


async def stream_strategy(request: CoachRequest):
    async for event in run_coach_pipeline_stream(request):
        yield event


def get_stats() -> dict:
    return _get_stats()


def record_feedback(rating: int, coaching_mode: str, regenerated: bool = False):
    _record_feedback(rating, coaching_mode, regenerated)
