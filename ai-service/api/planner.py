import logging
import secrets

from fastapi import APIRouter, Depends, Header, HTTPException, Request

from ports.llm import LLMError
from schemas.api import EditPlanRequest, EditPlanResponse, PlanTripRequest, PlanTripResponse

logger = logging.getLogger(__name__)
router = APIRouter()


def require_internal_key(request: Request, x_internal_key: str | None = Header(None)) -> None:
    """Only the VoyAgent backend may spend LLM and search quota."""
    expected = request.app.state.settings.internal_api_key
    if not x_internal_key or not secrets.compare_digest(x_internal_key, expected):
        raise HTTPException(status_code=401, detail="invalid_internal_key")


@router.post(
    "/plan-trip",
    response_model=PlanTripResponse,
    dependencies=[Depends(require_internal_key)],
)
def plan_trip(body: PlanTripRequest, request: Request) -> PlanTripResponse:
    try:
        return request.app.state.engine.plan(body)
    except LLMError:
        logger.exception("Planning failed for trip %s", body.trip_id)
        raise HTTPException(status_code=503, detail="planning_unavailable") from None


@router.post(
    "/edit-plan",
    response_model=EditPlanResponse,
    dependencies=[Depends(require_internal_key)],
)
def edit_plan(body: EditPlanRequest, request: Request) -> EditPlanResponse:
    try:
        return request.app.state.engine.edit(body)
    except LLMError:
        logger.exception("Editing failed for trip %s", body.trip_id)
        raise HTTPException(status_code=503, detail="planning_unavailable") from None
