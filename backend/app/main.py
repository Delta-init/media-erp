from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import connect_db, close_db, create_indexes

logger = logging.getLogger(__name__)

# ── Sentry (no-op when SENTRY_DSN is empty) ───────────────────────────────────
if settings.sentry_dsn:
    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    from sentry_sdk.integrations.starlette import StarletteIntegration

    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.app_env,
        traces_sample_rate=0.2,
        integrations=[StarletteIntegration(), FastApiIntegration()],
        send_default_pii=False,
    )
    logger.info("Sentry initialised (env=%s)", settings.app_env)
from app.routers import auth as auth_router
from app.routers import connectors as connectors_router
from app.routers import sync as sync_router
from app.routers import reports as reports_router
from app.routers import ai as ai_router
from app.routers import notifications as notifications_router
from app.routers import projects as projects_router
from app.routers import roles as roles_router
from app.routers import users as users_router
from app.routers import chat as chat_router
from app.routers import social as social_router
from app.utils.response import success_response


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    await create_indexes()
    yield
    await close_db()


app = FastAPI(
    title="mediaERP API",
    version="1.0.0",
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.allowed_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth_router.router)
app.include_router(connectors_router.router)
app.include_router(sync_router.router)
app.include_router(reports_router.router)
app.include_router(ai_router.router)
app.include_router(notifications_router.router)
app.include_router(projects_router.router)
app.include_router(roles_router.router)
app.include_router(users_router.router)
app.include_router(chat_router.router)
app.include_router(social_router.router)


@app.get("/api/v1/health", tags=["health"])
async def health():
    return success_response(
        data={"env": settings.app_env, "version": "1.0.0"},
        message="API is healthy",
    )
