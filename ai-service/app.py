import logging

from fastapi import FastAPI

from api.planner import router as planner_router
from graph.engine import PlanningEngine
from settings import Settings


def create_app(engine: PlanningEngine | None = None, settings: Settings | None = None) -> FastAPI:
    """App factory; run with `uvicorn app:create_app --factory`."""
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    settings = settings or Settings()
    show_docs = settings.environment != "production"

    app = FastAPI(
        title="VoyAgent Planning Engine",
        version="1.0.0",
        docs_url="/docs" if show_docs else None,
        redoc_url=None,
        openapi_url="/openapi.json" if show_docs else None,
    )
    if engine is None:
        from container import build_engine

        engine = build_engine(settings)
    app.state.settings = settings
    app.state.engine = engine
    app.include_router(planner_router, prefix="/planner", tags=["planner"])

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"service": "voyagent-ai", "status": "ok"}

    return app
