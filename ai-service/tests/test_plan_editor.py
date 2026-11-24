from datetime import date

import pytest

from graph.engine import PlanningEngine
from ports.fares import FareError
from ports.llm import LLMError
from schemas.api import ConversationTurn, EditPlanRequest, PlanTripRequest
from schemas.edit import PlanEdit
from schemas.itinerary import Activity, Itinerary, ItineraryDay
from schemas.plan import TripSummary
from schemas.recommendations import FlightRecommendation, HotelRecommendation
from schemas.travel import FareRange, TravelFares
from schemas.trip_request import TripRequest
from tests.fakes import FakeGeocoder, FakeLLM, SequenceSearch

TODAY = date(2026, 11, 22)
GOA = TripRequest(
    origin="Ahmedabad",
    destination="Goa",
    duration_days=3,
    budget=40_000,
    party_size=2,
    travel_style="relaxed",
    start_date="2026-12-10",
)
SUMMARY = TripSummary(summary="Beach days.", important_tips=[])


def days(*titles):
    return Itinerary(
        days=[
            ItineraryDay(
                day=i + 1,
                title=title,
                activities=[Activity(time="Morning", title=title, description="", location=title)],
            )
            for i, title in enumerate(titles)
        ]
    )


def hotel(name, price):
    return HotelRecommendation(name=name, location="Goa", price_per_night=price, rating=4.5)


IND = FlightRecommendation(
    airline="IndiGo", departure_airport="AMD", arrival_airport="GOI", price_per_traveler=5_000
)


class FakeFares:
    def __init__(self, fares=None, error=None):
        self._fares = fares
        self._error = error

    def estimate(self, query):
        if self._error:
            raise self._error
        return self._fares


class ScriptedLLM(FakeLLM):
    """FakeLLM whose PlanEdit answer is set per test, after the first plan is made."""

    def __init__(self, itineraries):
        self.edit = PlanEdit()
        self._itineraries = list(itineraries)
        super().__init__(
            {
                TripRequest: GOA,
                TripSummary: SUMMARY,
                PlanEdit: lambda _prompt: self.edit,
                Itinerary: lambda _prompt: self._itineraries.pop(0),
            }
        )


def engine_for(llm, hotels, flights, fares=None):
    return PlanningEngine(
        llm=llm,
        hotel_search=SequenceSearch(*hotels),
        flight_search=SequenceSearch(*flights),
        geocoder=FakeGeocoder(),
        today=lambda: TODAY,
        fares=fares,
    )


def first_plan(engine):
    turns = [ConversationTurn(role="traveler", content="Goa trip")]
    return engine.plan(PlanTripRequest(trip_id="t1", conversation=turns)).plan


def say(engine, plan, message, travel_mode=None):
    turns = [
        ConversationTurn(role="traveler", content="Goa trip"),
        ConversationTurn(role="assistant", content="Your Trip plan is ready."),
        ConversationTurn(role="traveler", content=message),
    ]
    return engine.edit(
        EditPlanRequest(trip_id="t1", conversation=turns, plan=plan, travel_mode=travel_mode)
    )


def test_a_question_gets_an_answer_and_the_plan_is_untouched():
    llm = ScriptedLLM([days("Baga")])
    engine = engine_for(llm, hotels=[[hotel("Sea View", 6_000)]], flights=[[IND]])
    plan = first_plan(engine)
    llm.edit = PlanEdit(answer="Try Ritz Classic in Panjim for fish thali.")

    response = say(engine, plan, "where should we eat in Panjim?")

    assert response.outcome == "answered"
    assert response.reply == "Try Ritz Classic in Panjim for fish thali."
    assert response.plan is None


def test_a_new_length_re_plans_stays_travel_and_days():
    llm = ScriptedLLM([days("Baga"), days("Baga", "Palolem", "Fort", "Market")])
    engine = engine_for(
        llm,
        hotels=[[hotel("Sea View", 6_000)], [hotel("Sea View", 5_000)]],
        flights=[[IND], [IND]],
    )
    plan = first_plan(engine)
    llm.edit = PlanEdit(changes=TripRequest(duration_days=4))

    response = say(engine, plan, "make it 4 days")

    assert response.outcome == "updated"
    assert response.plan.nights == 4
    assert len(response.plan.itinerary) == 4
    assert response.plan.estimated_cost.hotel_total == 20_000  # new search: 5,000 x 4 nights
    assert "4 days" in response.reply


def test_a_bigger_group_keeps_the_days():
    llm = ScriptedLLM([days("Baga", "Palolem")])  # a second itinerary would fail the test
    engine = engine_for(
        llm,
        hotels=[[hotel("Sea View", 6_000)], [hotel("Sea View", 6_000)]],
        flights=[[IND], [IND]],
    )
    plan = first_plan(engine)
    llm.edit = PlanEdit(changes=TripRequest(party_size=4, budget=80_000))

    response = say(engine, plan, "we are 4 now, 80k")

    assert response.outcome == "updated"
    assert [d.title for d in response.plan.itinerary] == ["Baga", "Palolem"]
    assert response.plan.estimated_cost.rooms == 2


def test_a_day_plan_change_keeps_stays_and_travel_without_new_searches():
    llm = ScriptedLLM([days("Baga", "Palolem"), days("Baga", "Dudhsagar")])
    # One answer each: a second search would fail the test.
    engine = engine_for(llm, hotels=[[hotel("Sea View", 6_000)]], flights=[[IND]])
    plan = first_plan(engine)
    llm.edit = PlanEdit(itinerary_change="swap day 2 for Dudhsagar Falls")

    response = say(engine, plan, "swap day 2 for Dudhsagar falls")

    assert response.outcome == "updated"
    assert [d.title for d in response.plan.itinerary] == ["Baga", "Dudhsagar"]
    assert response.plan.hotels == plan.hotels
    assert response.plan.flights == plan.flights
    assert response.plan.travel_options == plan.travel_options


def test_the_picked_travel_mode_is_counted():
    fares = TravelFares(train_ac3=FareRange(low=1_500, high=2_000))
    llm = ScriptedLLM([days("Baga"), days("Baga", "Palolem")])
    engine = engine_for(
        llm,
        hotels=[[hotel("Sea View", 6_000)]],
        flights=[[IND]],
        fares=FakeFares(fares),
    )
    plan = first_plan(engine)
    assert plan.estimated_cost.travel_mode == "train"  # 7,000 beats 10,000 by air
    llm.edit = PlanEdit(itinerary_change="add Palolem")

    response = say(engine, plan, "add Palolem", travel_mode="flight")

    assert response.plan.estimated_cost.travel_mode == "flight"
    assert response.plan.estimated_cost.travel_total == 10_000


def test_fares_outage_is_a_note_not_a_failure():
    llm = ScriptedLLM([days("Baga")])
    engine = engine_for(
        llm,
        hotels=[[hotel("Sea View", 6_000)]],
        flights=[[IND]],
        fares=FakeFares(error=FareError("quota")),
    )

    plan = first_plan(engine)

    assert [o.mode for o in plan.travel_options] == ["flight"]
    assert any("IRCTC" in note for note in plan.notes)


def test_unclear_message_says_how_to_ask():
    llm = ScriptedLLM([days("Baga")])
    engine = engine_for(llm, hotels=[[hotel("Sea View", 6_000)]], flights=[[IND]])
    plan = first_plan(engine)
    llm.edit = PlanEdit(changes=TripRequest(duration_days=3))  # same as now: nothing changes

    response = say(engine, plan, "hmm")

    assert response.outcome == "answered"
    assert "make it 4 days" in response.reply


def test_llm_outage_is_raised_for_the_api_to_report():
    class DownForEdits(ScriptedLLM):
        def generate(self, output_type, *, system, prompt):
            if output_type is PlanEdit:
                raise LLMError("down")
            return super().generate(output_type, system=system, prompt=prompt)

    llm = DownForEdits([days("Baga")])
    engine = engine_for(llm, hotels=[[hotel("Sea View", 6_000)]], flights=[[IND]])
    plan = first_plan(engine)

    with pytest.raises(LLMError):
        say(engine, plan, "make it cheaper")
