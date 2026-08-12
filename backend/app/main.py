import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

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

# Allow origins can be configured via the ALLOWED_ORIGINS environment variable
# as a comma-separated list (e.g. "http://localhost:3000,https://my-app.vercel.app").
allowed = os.getenv("ALLOWED_ORIGINS")
if allowed:
    allow_origins = [o.strip() for o in allowed.split(",") if o.strip()]
else:
    allow_origins = ["http://localhost:3000", "https://solorank-vkhzef00k-sumit-s-projects20.vercel.app/"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "arise-coach-backend"}
