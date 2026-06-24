from fastapi import APIRouter

from app.api.routes import admin, coach, meta

api_router = APIRouter()
api_router.include_router(coach.router, prefix="/coach", tags=["coach"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(meta.router,  prefix="/meta",  tags=["meta"])
