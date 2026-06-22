from fastapi import APIRouter

from app.schemas.coach import CoachRequest
from app.services.coach_service import get_strategy

router = APIRouter()


@router.post("/strategy")
async def strategy_endpoint(request: CoachRequest):
    return await get_strategy(request)
