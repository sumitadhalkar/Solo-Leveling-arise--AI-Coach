from fastapi import APIRouter

from app.api.routes import coach

api_router = APIRouter()
api_router.include_router(coach.router, prefix="/coach", tags=["coach"])
