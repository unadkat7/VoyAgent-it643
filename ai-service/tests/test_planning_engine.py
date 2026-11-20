from datetime import date

import pytest

from graph.engine import PlanningEngine
from ports.llm import LLMError
from ports.search import SearchError
from schemas.api import ConversationTurn, PlanTripRequest
from schemas.geo import GeoPoint
from schemas.itinerary import Activity, Itinerary, ItineraryDay
from schemas.plan import TripSummary
from schemas.recommendations import FlightRecommendation, HotelRecommendation
from schemas.trip_request import TripRequest
from tests.fakes import BrokenLLM, FakeGeocoder, FakeLLM, SequenceSearch

TODAY = date(2026, 11, 22)

GOA_REQUEST = TripRequest(
    origin="Ahmedabad",
    destination="Goa",
    duration_days=3,
    budget=40_000,  # hotel cap 6,666/night; flight cap 7,000 + grace = 8,050 per Traveler
    party_size=2,
    travel_style="relaxed",
    start_date="2026-12-10",
)
ITINERARY = Itinerary(
    days=[
        ItineraryDay(
            day=1,
            title="Beaches",
            activities=[
                Activity(time="Morning", title="Baga", description="Swim", location="Baga")
            ],
        )
    ]
)
SUMMARY = TripSummary(summary="Three easy beach days.", important_tips=["Carry sunscreen"])


def hotel(name, price, rating, source="live"):
    return HotelRecommendation(
        name=name, location="Goa", price_per_night=price, rating=rating, price_source=source
    )


def flight(airline, price):
    return FlightRecommendation(
        airline=airline,
        departure_airport="AMD",
        arrival_airport="GOI",
        price_per_traveler=price,
        price_source="live",
    )


def llm_for(request: TripRequest):
    return FakeLLM({TripRequest: request, Itinerary: ITINERARY, TripSummary: SUMMARY})


def ask(engine: PlanningEngine, *messages: str):
    turns = [ConversationTurn(role="traveler", content=m) for m in messages]
    return engine.plan(PlanTripRequest(trip_id="trip-1", conversation=turns))


def make_engine(llm, hotels=None, flights=None, geocoder=None):
    hotel_search = SequenceSearch(*hotels) if hotels is not None else SequenceSearch()
    flight_search = SequenceSearch(*flights) if flights is not None else SequenceSearch()
    return PlanningEngine(
        llm=llm,
        hotel_search=hotel_search,
        flight_search=flight_search,
        geocoder=geocoder or FakeGeocoder(),
        today=lambda: TODAY,
    )


# Rule 1 -------------------------------------------------------------------


def test_vague_request_gets_a_clarification_listing_missing_fields():
    engine = make_engine(llm_for(TripRequest(destination="Goa")))

    response = ask(engine, "I want to go to Goa")

    assert response.status == "needs_clarification"
    assert response.plan is None
    assert response.clarification.missing_fields == [
        "origin",
        "duration_days",
        "budget",
        "party_size",
        "travel_style",
    ]
    assert "starting from" in response.clarification.question


def test_missing_fields_are_decided_by_the_rule_not_the_llm():
    # The LLM returns budget=0; Rule 1 still treats it as missing.
    engine = make_engine(llm_for(GOA_REQUEST.model_copy(update={"budget": 0})))

    response = ask(engine, "Goa trip")

    assert response.clarification.missing_fields == ["budget"]


# Rules 2 and 3 --------------------------------------------------------------


def test_complete_request_is_planned_with_recommendations_inside_the_caps():
    engine = make_engine(
        llm_for(GOA_REQUEST),
        hotels=[
            [
                hotel("Over Cap", 7_000, 5.0),
                hotel("Sea View", 6_000, 4.5),
                hotel("Budget Inn", 3_000, 4.0),
            ]
        ],
        flights=[[flight("Expensive Air", 9_000), flight("IndiGo", 5_000)]],
    )

    response = ask(engine, "Ahmedabad to Goa, 3 days, 40k, 2 people, relaxed, from 10 Dec")

    assert response.status == "planned"
    plan = response.plan
    assert [h.name for h in plan.hotels] == ["Sea View", "Budget Inn"]
    assert [f.airline for f in plan.flights] == ["IndiGo"]
    assert plan.check_in == "2026-12-10"
    assert plan.check_out == "2026-12-13"
    assert plan.nights == 3


def test_estimated_cost_uses_cheapest_hotel_for_all_nights_and_flight_for_whole_party():
    engine = make_engine(
        llm_for(GOA_REQUEST),
        hotels=[[hotel("Sea View", 6_000, 4.5), hotel("Budget Inn", 3_000, 4.0)]],
        flights=[[flight("IndiGo", 5_000)]],
    )

    cost = ask(engine, "plan it").plan.estimated_cost

    assert cost.hotel_total == 9_000  # 3,000 x 3 nights
    assert cost.flight_total == 10_000  # 5,000 x 2 Travelers
    assert cost.total == 19_000
    assert cost.currency == "INR"


def test_recommendations_reach_the_plan_unchanged():
    estimated = hotel("Estimated Stay", 2_000, 3.9, source="estimated")
    engine = make_engine(
        llm_for(GOA_REQUEST), hotels=[[estimated]], flights=[[flight("IndiGo", 5_000)]]
    )

    plan = ask(engine, "plan it").plan

    assert plan.hotels == [estimated]
    assert plan.summary == SUMMARY.summary
    assert plan.itinerary == ITINERARY.days


def test_plan_carries_coordinates_for_the_trip_map():
    goa, baga = GeoPoint(lat=15.3, lng=74.1), GeoPoint(lat=15.55, lng=73.75)
    engine = make_engine(
        llm_for(GOA_REQUEST),
        hotels=[[hotel("Sea View", 6_000, 4.5)]],
        flights=[[flight("IndiGo", 5_000)]],
        geocoder=FakeGeocoder({"Goa": goa, "Baga, Goa": baga}),
    )

    plan = ask(engine, "plan it").plan

    assert plan.destination_coordinates == goa
    assert plan.itinerary[0].activities[0].coordinates == baga


def test_when_no_hotel_fits_the_nightly_cap_traveler_is_asked_to_raise_budget():
    engine = make_engine(
        llm_for(GOA_REQUEST),
        hotels=[[hotel("Palace", 9_000, 4.8), hotel("Resort", 7_500, 4.6)]],
        flights=[[flight("IndiGo", 5_000)]],
    )

    response = ask(engine, "plan it")

    assert response.status == "needs_clarification"
    assert response.clarification.missing_fields == ["budget"]
    assert "7,500" in response.clarification.question


# Rule 4 -------------------------------------------------------------------


def test_destination_without_known_airport_skips_flights_instead_of_guessing():
    manali = GOA_REQUEST.model_copy(update={"destination": "Manali"})
    # No flight answers prepared: calling the flight search would fail this test.
    engine = make_engine(llm_for(manali), hotels=[[hotel("Snow Lodge", 3_000, 4.2)]], flights=[])

    plan = ask(engine, "Manali trip").plan

    assert plan.flights == []
    assert any("Manali" in note for note in plan.notes)


# Degraded providers ---------------------------------------------------------


def test_unavailable_flight_search_still_produces_a_plan_with_a_note():
    engine = make_engine(
        llm_for(GOA_REQUEST),
        hotels=[[hotel("Sea View", 6_000, 4.5)]],
        flights=[SearchError("quota and estimates down")],
    )

    plan = ask(engine, "plan it").plan

    assert plan.flights == []
    assert any("flight" in note.lower() for note in plan.notes)


def test_llm_outage_is_reported_not_hidden():
    engine = make_engine(BrokenLLM())

    with pytest.raises(LLMError):
        ask(engine, "Goa trip")
