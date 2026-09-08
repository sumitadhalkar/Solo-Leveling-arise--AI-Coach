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

# Allowed origins come from the ALLOWED_ORIGINS environment variable as a
# comma-separated list (e.g. "http://localhost:3000,https://my-app.vercel.app").
# Trailing slashes are stripped: the browser's Origin header never has one, and
# CORS origin matching is an exact string comparison.
def _clean(origins):
    return [o.strip().rstrip("/") for o in origins if o.strip()]


DEFAULT_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

allowed = os.getenv("ALLOWED_ORIGINS")
allow_origins = _clean(allowed.split(",")) if allowed else DEFAULT_ORIGINS

# Vercel mints a new hostname for every deployment, so match them by pattern
# instead of pinning a single build URL that goes stale on the next push.
ALLOW_ORIGIN_REGEX = os.getenv(
    "ALLOWED_ORIGIN_REGEX",
    r"https://.*\.vercel\.app",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_origin_regex=ALLOW_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "arise-coach-backend"}
