import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.routers import polls

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


@app.get("/health", tags=["health"])
def health_check():
    return {"status": "ok"}


# Decision 8: Serve static frontend directly without build tools
frontend_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend")
if os.path.exists(frontend_path):
    app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")

