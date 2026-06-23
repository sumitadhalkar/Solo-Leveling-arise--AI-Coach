from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.schemas.coach import CoachRequest, FeedbackRequest
from app.services.coach_service import get_stats, get_strategy, record_feedback, stream_strategy

router = APIRouter()


@router.post("/strategy")
async def strategy_endpoint(request: CoachRequest):
    return await get_strategy(request)


@router.post("/stream")
async def strategy_stream(request: CoachRequest):
    return StreamingResponse(
        stream_strategy(request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.get("/stats")
async def stats_endpoint():
    """Live analytics — cache hit rate, latency by category, feedback quality, top hunters."""
    return get_stats()


@router.post("/feedback")
async def feedback_endpoint(request: FeedbackRequest):
    """Record a user thumbs-up, thumbs-down, or regenerate signal."""
    record_feedback(request.rating, request.coaching_mode, request.regenerated)
    return {"ok": True}
