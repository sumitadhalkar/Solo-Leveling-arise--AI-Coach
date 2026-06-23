import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.workers.snapshot import snapshot_worker


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(snapshot_worker())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title="Solo Leveling: ARISE AI Coach",
    description="Personalized strategy recommendations powered by Gemini + Google Search",
    version="0.3.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "arise-coach-backend"}
