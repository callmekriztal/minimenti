import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.routers import polls, presentations

app = FastAPI(
    title="Mini Mentimeter API",
    description="Live polling backend for interactive presentations",
    version="0.1.0",
)

# Decision 7: CORS origin whitelist configured via settings
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(polls.router)
app.include_router(presentations.router)


@app.get("/health", tags=["health"])
def health_check():
    return {"status": "ok"}


# Decision 9: Serve compiled React SPA
dist_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist")
frontend_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend")
static_dir = dist_path if os.path.exists(dist_path) else frontend_path

if os.path.exists(static_dir):
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="frontend")


