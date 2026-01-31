from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .db import Base, engine
from .routers import auth, subscribers, files, newsletters, jobs, extract


def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name)

    Base.metadata.create_all(bind=engine)

    origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=settings.cors_allow_credentials,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(auth.router, prefix=settings.api_prefix)
    app.include_router(subscribers.router, prefix=settings.api_prefix)
    app.include_router(files.router, prefix=settings.api_prefix)
    app.include_router(newsletters.router, prefix=settings.api_prefix)
    app.include_router(jobs.router, prefix=settings.api_prefix)
    app.include_router(extract.router, prefix=settings.api_prefix)

    return app


app = create_app()
