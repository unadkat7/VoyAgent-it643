from datetime import date

import pytest

from agents.itinerary import SYSTEM as ITINERARY_SYSTEM
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


def test_request_without_a_destination_asks_only_where_to_go():
    engine = make_engine(llm_for(TripRequest(origin="Mumbai")))

    response = ask(engine, "plan me a holiday from Mumbai")

    assert response.status == "needs_clarification"
    assert response.plan is None
    assert response.clarification.missing_fields == ["destination"]


def test_bare_request_is_planned_with_stated_assumptions_and_a_follow_up():
    ooty = TripRequest(origin="Mumbai", destination="Ooty")
    # Ooty has no known airport, so no flight answer is needed.
    engine = make_engine(llm_for(ooty), hotels=[[hotel("Hill View", 3_000, 4.2)]], flights=[])

    plan = ask(engine, "plan a trip from Mumbai to Ooty").plan

    assert plan.request.duration_days == 3
    assert plan.request.party_size == 2
    assert plan.nights == 3
    assert plan.assumed_fields == ["duration_days", "party_size", "travel_style", "budget"]
    assert any("3 days" in line for line in plan.assumptions)
    assert "budget" in plan.follow_up


def test_missing_origin_skips_travel_and_says_how_to_get_it():
    no_origin = GOA_REQUEST.model_copy(update={"origin": None})
    # No flight answers prepared: searching flights would fail this test.
    engine = make_engine(llm_for(no_origin), hotels=[[hotel("Sea View", 6_000, 4.5)]], flights=[])

    plan = ask(engine, "Goa, 3 days, 40k, 2 people, relaxed").plan

    assert plan.flights == []
    assert plan.assumed_fields == ["origin"]
    assert any("starting from" in note for note in plan.notes)


def test_guessed_budget_never_blocks_the_plan():
    no_budget = GOA_REQUEST.model_copy(update={"budget": None})
    # Guessed Budget for 2 relaxed Travelers over 3 days is 36,000: 6,000 a night for the stay.
    engine = make_engine(
        llm_for(no_budget),
        hotels=[[hotel("Palace", 9_000, 4.8), hotel("Resort", 7_500, 4.6)]],
        flights=[[flight("IndiGo", 15_000)]],
    )

    response = ask(engine, "Ahmedabad to Goa, 3 days, 2 people")

    assert response.status == "planned"
    assert [h.name for h in response.plan.hotels] == ["Resort", "Palace"]
    assert [f.airline for f in response.plan.flights] == ["IndiGo"]


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


def test_estimated_cost_prices_the_first_listed_stay_and_adds_activities_and_daily_spend():
    priced_itinerary = Itinerary(
        days=[
            ItineraryDay(
                day=1,
                title="Beaches",
                activities=[
                    Activity(
                        time="Morning",
                        title="Cruise",
                        description="Sail",
                        location="Panjim",
                        estimated_cost=500,
                    ),
                    Activity(time="Evening", title="Baga", description="Swim", location="Baga"),
                ],
            )
        ]
    )
    llm = FakeLLM({TripRequest: GOA_REQUEST, Itinerary: priced_itinerary, TripSummary: SUMMARY})
    engine = make_engine(
        llm,
        hotels=[[hotel("Budget Inn", 3_000, 4.0), hotel("Sea View", 6_000, 4.5)]],
        flights=[[flight("IndiGo", 5_000)]],
    )

    plan = ask(engine, "plan it").plan
    cost = plan.estimated_cost

    assert plan.hotels[0].name == "Sea View"  # best rated is listed first
    assert cost.hotel_total == 18_000  # 6,000 x 3 nights x 1 room
    assert cost.travel_total == 10_000  # 5,000 x 2 Travelers
    assert cost.travel_mode == "flight"
    assert cost.activities_total == 1_000  # 500 x 2 Travelers
    assert cost.daily_spend_total == 9_000  # 1,500 x 3 days x 2 Travelers
    assert cost.total == 38_000
    assert cost.per_person == 19_000
    assert cost.rooms == 1
    assert cost.currency == "INR"


def test_three_days_two_nights_books_two_nights():
    engine = make_engine(
        llm_for(GOA_REQUEST.model_copy(update={"nights": 2})),
        hotels=[[hotel("Sea View", 6_000, 4.5)]],
        flights=[[flight("IndiGo", 5_000)]],
    )

    plan = ask(engine, "Goa 3D/2N").plan

    assert plan.nights == 2
    assert plan.check_out == "2026-12-12"


def test_nights_that_do_not_fit_are_explained_in_a_note():
    engine = make_engine(
        llm_for(GOA_REQUEST.model_copy(update={"nights": 5})),
        hotels=[[hotel("Sea View", 6_000, 4.5)]],
        flights=[[flight("IndiGo", 5_000)]],
    )

    plan = ask(engine, "Goa 3 days 5 nights").plan

    assert plan.nights == 3
    assert any("don't line up" in note for note in plan.notes)


def test_itinerary_is_told_the_nights_and_not_how_travelers_arrive():
    prompts = []

    def itinerary(prompt):
        prompts.append(prompt)
        return ITINERARY

    llm = FakeLLM(
        {
            TripRequest: GOA_REQUEST.model_copy(update={"nights": 2}),
            Itinerary: itinerary,
            TripSummary: SUMMARY,
        }
    )
    engine = make_engine(
        llm, hotels=[[hotel("Sea View", 6_000, 4.5)]], flights=[[flight("IndiGo", 5_000)]]
    )

    ask(engine, "Goa 3D/2N")

    assert "3 days, 2 nights" in prompts[0]
    assert "Never name an\nairport" in ITINERARY_SYSTEM
    # Food has its own line in the Estimated Cost, so Activities must not price meals too.
    assert "Meals, food, drinks and local taxis are counted separately" in ITINERARY_SYSTEM


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


def test_flights_over_the_flight_share_are_shown_flagged_not_dropped():
    engine = make_engine(
        llm_for(GOA_REQUEST),  # flight cap 8,050 per Traveler
        # 9,000 stay + 24,000 flights still fits the 40,000 Budget, so the plan goes ahead.
        hotels=[[hotel("Budget Inn", 3_000, 4.0)]],
        flights=[[flight("Air India", 13_000), flight("IndiGo", 12_000)]],
    )

    plan = ask(engine, "plan it").plan

    assert [f.airline for f in plan.flights] == ["IndiGo", "Air India"]
    assert all(f.over_budget for f in plan.flights)
    assert plan.travel_options[0].over_budget is True
    assert plan.estimated_cost.travel_total == 24_000
    assert any("flight share" in note for note in plan.notes)


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


@pytest.mark.parametrize(("fields", "field", "reason"), [
    ({"destination": "Sun", "destination_kind": "not_on_earth"}, "destination", "not_on_earth"),
    ({"destination": "Antarctica", "destination_area": "polar"}, "destination", "unreachable"),
    ({"destination": "Atlantiss"}, "destination", "not_a_place"),
    ({"origin": "Direct Antarctica"}, "origin", "not_a_place"),
    ({"duration_days": 45}, "duration_days", None),
])
def test_invalid_request_asks_before_any_search(fields, field, reason):
    request = TripRequest(**(GOA_REQUEST.model_dump() | fields))
    engine = make_engine(llm_for(request), geocoder=FakeGeocoder({"Goa": GeoPoint(lat=15, lng=74)}))

    response = ask(engine, "plan it")

    assert response.plan is None
    assert response.clarification.missing_fields == [field]
    assert response.clarification.reason == reason


def test_map_outage_allows_planning_with_a_note():
    from ports.geocoder import GeocodeError

    engine = make_engine(llm_for(GOA_REQUEST), hotels=[[]], flights=[[]],
                         geocoder=FakeGeocoder(error=GeocodeError("down")))

    plan = ask(engine, "Goa").plan

    assert any("double-check 'Goa'" in note for note in plan.notes)
