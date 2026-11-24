from datetime import date

import pytest
from fastapi.testclient import TestClient

from app import create_app
from graph.engine import PlanningEngine
from schemas.trip_request import TripRequest
from settings import Settings
from tests.fakes import BrokenLLM, FakeGeocoder, FakeLLM, SequenceSearch

KEY = "test-internal-key-123456"
PLAN_URL = "/planner/plan-trip"
BODY = {"trip_id": "trip-1", "conversation": [{"role": "traveler", "content": "Goa trip"}]}


def settings(environment="test") -> Settings:
    return Settings(internal_api_key=KEY, environment=environment, _env_file=None)


def client(llm=None, environment="test") -> TestClient:
    engine = PlanningEngine(
        # No Destination: the one thing the Planning Engine must ask for before planning.
        llm=llm or FakeLLM({TripRequest: TripRequest(origin="Ahmedabad")}),
        hotel_search=SequenceSearch(),
        flight_search=SequenceSearch(),
        geocoder=FakeGeocoder(),
        today=lambda: date(2026, 11, 22),
    )
    return TestClient(create_app(engine=engine, settings=settings(environment)))


def test_health_needs_no_key():
    response = client().get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


@pytest.mark.parametrize("headers", [{}, {"X-Internal-Key": "wrong-key"}], ids=["none", "wrong"])
def test_planning_requires_the_internal_key(headers):
    response = client().post(PLAN_URL, json=BODY, headers=headers)

    assert response.status_code == 401


def test_planning_with_the_key_returns_the_engine_answer():
    response = client().post(PLAN_URL, json=BODY, headers={"X-Internal-Key": KEY})

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "needs_clarification"
    assert body["trip_id"] == "trip-1"
    assert body["clarification"]["missing_fields"] == ["destination"]


def test_editing_a_plan_requires_the_internal_key():
    response = client().post("/planner/edit-plan", json={"trip_id": "t1"})

    assert response.status_code == 401


def test_conversation_must_end_with_the_traveler():
    body = {**BODY, "conversation": [{"role": "assistant", "content": "Where to?"}]}

    response = client().post(PLAN_URL, json=body, headers={"X-Internal-Key": KEY})

    assert response.status_code == 422


def test_llm_outage_is_a_503_without_provider_details():
    response = client(llm=BrokenLLM("groq secret detail")).post(
        PLAN_URL, json=BODY, headers={"X-Internal-Key": KEY}
    )

    assert response.status_code == 503
    assert "groq secret detail" not in response.text


@pytest.mark.parametrize(("environment", "status"), [("development", 200), ("production", 404)])
def test_api_docs_are_hidden_in_production(environment, status):
    assert client(environment=environment).get("/docs").status_code == status


def test_settings_reject_a_short_internal_key():
    with pytest.raises(ValueError):
        Settings(internal_api_key="short", _env_file=None)
