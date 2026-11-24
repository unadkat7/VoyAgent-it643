import pytest

from adapters.no_geocoder import NoGeocoder
from domain.feasibility import minimum_trip_cost
from domain.route_rules import fit_stops
from graph.engine import PlanningEngine
from schemas.api import ConversationTurn, EditPlanRequest
from schemas.edit import PlanEdit
from schemas.itinerary import Itinerary, ItineraryDay
from schemas.plan import TripSummary
from schemas.route import RoutePlan, RouteStop, StopLeg
from schemas.trip_request import TripRequest
from tests.fakes import FakeLLM, SequenceSearch
from tests.test_planning_engine import SUMMARY, TODAY, ask, flight, hotel

CITIES = [("Paris", "CDG"), ("Brussels", "BRU"), ("Amsterdam", "AMS"), ("Berlin", "BER")]
STOPS = [RouteStop(city=city, days=2, airport_code=code) for city, code in CITIES]
LEGS = [
    StopLeg(from_city=a.city, to_city=b.city, mode="train", est_inr_per_person=1000)
    for a, b in zip(STOPS, STOPS[1:], strict=False)
]


@pytest.mark.parametrize(("days", "requested", "expected"), [(3, 3, 1), (8, 5, 4), (10, 4, 4)])
def test_route_fits_available_days(days, requested, expected):
    stops, notes = fit_stops((STOPS + [RouteStop(city="Rome", days=2)])[:requested], days)

    assert len(stops) == expected
    assert sum(stop.days for stop in stops) == days
    assert bool(notes) == (requested > expected)


class RecordingSearch(SequenceSearch):
    def __init__(self, *answers):
        super().__init__(*answers)
        self.queries = []

    def search_hotels(self, query):
        self.queries.append(query)
        return super().search_hotels(query)

    def search_flights(self, query):
        self.queries.append(query)
        return super().search_flights(query)


def europe(days=None, budget=None):
    return TripRequest(
        destination="Europe",
        destination_kind="multi_country",
        destination_area="europe",
        duration_days=days,
        budget=budget,
        party_size=2,
        origin="Mumbai",
    )


def engine_for(request, edit=None, route=None):
    def itinerary(_):
        return Itinerary(
            days=[
                ItineraryDay(day=n + 1, title="Walk", activities=[])
                for n in range(request.duration_days or 5)
            ]
        )

    llm = FakeLLM(
        {
            TripRequest: request,
            RoutePlan: route or RoutePlan(stops=STOPS, legs=LEGS),
            Itinerary: itinerary,
            TripSummary: SUMMARY,
            PlanEdit: edit or PlanEdit(),
        }
    )
    stays = RecordingSearch(*[[hotel(s.city, 2000, 4)] for s in STOPS] * 2)
    air = RecordingSearch(*[[flight("Air", 20000)]] * 4)
    engine = PlanningEngine(
        llm=llm, hotel_search=stays, flight_search=air, geocoder=NoGeocoder(), today=lambda: TODAY
    )
    return engine, stays, air


@pytest.mark.parametrize(
    ("request_days", "budget", "field"), [(3, 36000, "budget"), (2, None, "duration_days")]
)
def test_infeasible_europe_requires_clarification_before_search(request_days, budget, field):
    engine, stays, air = engine_for(europe(request_days, budget))

    clarification = ask(engine, "Europe").clarification

    assert clarification.missing_fields == [field]
    assert clarification.reason is None
    assert not stays.queries and not air.queries
    if budget:
        assert "174,000" in clarification.question.replace("1,74,000", "174,000")


def test_europe_without_details_assumes_feasible_days_and_budget():
    engine, _, _ = engine_for(europe())

    plan = ask(engine, "Europe").plan

    assert len(plan.stops) >= 2
    assert minimum_trip_cost("europe", 3, 2) == 174000
    assert minimum_trip_cost(None, 3, 2) == 0
    assert plan.request.budget >= minimum_trip_cost("europe", plan.request.duration_days, 2)


def test_four_city_plan_prices_consecutive_stays_both_flights_and_transfers():
    engine, stays, air = engine_for(europe(10, 500000))

    plan = ask(engine, "Europe").plan

    assert (
        [s.city for s in plan.stops]
        == [q.destination for q in stays.queries]
        == [s.city for s in STOPS]
    )
    assert all(
        a.check_out == b.check_in for a, b in zip(stays.queries, stays.queries[1:], strict=False)
    )
    assert [(q.origin_airport, q.destination_airport, q.return_date) for q in air.queries] == [
        ("BOM", "CDG", None),
        ("BER", "BOM", None),
    ]
    assert [d.stop for d in plan.itinerary] == [
        i for i, s in enumerate(plan.stops) for _ in range(s.days)
    ]
    assert plan.estimated_cost.hotel_total == 20000
    assert plan.estimated_cost.legs_total == 6000
    assert plan.estimated_cost.travel_total == 86000
    assert plan.hotels == plan.stops[0].hotels
    assert plan.legs == LEGS


@pytest.mark.parametrize("change_days", [False, True])
def test_chat_preserves_or_replans_route_for_the_requested_change(change_days):
    edit = (
        PlanEdit(changes=TripRequest(duration_days=8))
        if change_days
        else PlanEdit(itinerary_change="More museums")
    )
    engine, stays, _ = engine_for(europe(10, 500000), edit)
    plan = ask(engine, "Europe").plan

    result = engine.edit(
        EditPlanRequest(
            trip_id="t", plan=plan, conversation=[ConversationTurn(role="traveler", content="edit")]
        )
    )

    assert result.plan.legs == plan.legs
    if change_days:
        assert sum(s.days for s in result.plan.stops) == 8
        assert len(stays.queries) == 8
    else:
        assert result.plan.stops == plan.stops
        assert len(stays.queries) == 4


@pytest.mark.parametrize(("origin", "transit"), [("Mumbai", "Mumbai"), (None, "Delhi")])
def test_overseas_route_uses_only_destination_bases(origin, transit):
    request = europe(10, 500000).model_copy(update={"origin": origin})
    proposed = RoutePlan(
        stops=[RouteStop(city=transit, country="India", days=2), *STOPS], legs=LEGS
    )
    engine, stays, _ = engine_for(request, route=proposed)

    plan = ask(engine, "Europe").plan

    assert [s.city for s in plan.stops] == [s.city for s in STOPS]
    assert [q.destination for q in stays.queries] == [s.city for s in STOPS]
    assert sum(s.days for s in plan.stops) == 10


def test_expensive_intercity_legs_trigger_trip_wide_cost_guard():
    expensive = [leg.model_copy(update={"est_inr_per_person": 100000}) for leg in LEGS]
    engine, _, _ = engine_for(europe(10, 500000), route=RoutePlan(stops=STOPS, legs=expensive))

    clarification = ask(engine, "Europe").clarification

    assert clarification.missing_fields == ["budget"]
    assert "stay and travel" in clarification.question
