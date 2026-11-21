"""FastAPI application entry point for ChaosEngine AI backend."""

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.app.api.v1.incidents import router as incidents_router
from backend.app.api.v1.postmortems import router as postmortems_router
from backend.app.api.v1.rca import router as rca_router
from backend.app.api.v1.sandboxes import router as sandboxes_router
from backend.app.api.v1.telemetry import router as telemetry_router
from backend.app.api.v1.topologies import router as topologies_router
from backend.app.core.config import settings

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
    docs_url=f"{settings.API_V1_PREFIX}/docs",
    redoc_url=f"{settings.API_V1_PREFIX}/redoc",
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "service": "ChaosEngine AI Backend", "version": "1.0.0"}


# Mount API V1 Routers
app.include_router(incidents_router, prefix=settings.API_V1_PREFIX)
app.include_router(postmortems_router, prefix=settings.API_V1_PREFIX)
app.include_router(rca_router, prefix=settings.API_V1_PREFIX)
app.include_router(sandboxes_router, prefix=settings.API_V1_PREFIX)
app.include_router(telemetry_router, prefix=settings.API_V1_PREFIX)
app.include_router(topologies_router, prefix=settings.API_V1_PREFIX)
