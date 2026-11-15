from fastapi import FastAPI

from app.routers import polls

app = FastAPI(
    title="Mini Mentimeter API",
    description="Live polling backend for interactive presentations",
    version="0.1.0",
)

app.include_router(polls.router)


@app.get("/health", tags=["health"])
def health_check():
    return {"status": "ok"}
