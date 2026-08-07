"""
AnnotatePay FastAPI entrypoint.

Run locally:
    uvicorn main:app --reload --host 0.0.0.0 --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import analytics, calculations, exports, health

settings = get_settings()

app = FastAPI(
    title="AnnotatePay API",
    version="1.0.0",
    description=(
        "Backend for AnnotatePay analytics, exports, and earnings calculations. "
        "Auth: Supabase JWT (Bearer). Data access forwards the user JWT to "
        "Supabase PostgREST so RLS enforces isolation."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(analytics.router)
app.include_router(exports.router)
app.include_router(calculations.router)


@app.get("/", include_in_schema=False)
async def root() -> dict[str, str]:
    return {"service": "annotate-pay-api", "docs": "/docs"}
