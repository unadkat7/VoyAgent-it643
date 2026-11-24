from datetime import date

from adapters.estimate_search import EstimateSearch
from ports.search import FlightQuery, HotelQuery
from ports.web_search import WebResult, WebSearchError
from schemas.recommendations import (
    FlightRecommendation,
    FlightRecommendations,
    HotelRecommendation,
    HotelRecommendations,
)
from tests.fakes import FakeLLM

HOTEL_QUERY = HotelQuery(
    destination="Manali",
    check_in=date(2026, 12, 10),
    check_out=date(2026, 12, 12),
    adults=2,
    max_price_per_night=3000,
    travel_style="adventure",
    accommodation_type=None,
)
FLIGHT_QUERY = FlightQuery(
    origin_airport="DEL",
    destination_airport="KUU",
    outbound_date=date(2026, 12, 10),
    return_date=date(2026, 12, 12),
    max_price_per_traveler=8000,
)


def test_estimated_hotels_are_always_labelled_estimated():
    claimed_live = HotelRecommendation(
        name="Snow Peak Lodge", location="Old Manali", price_per_night=2500, price_source="live"
    )
    search = EstimateSearch(
        FakeLLM({HotelRecommendations: HotelRecommendations(hotels=[claimed_live])})
    )

    hotels = search.search_hotels(HOTEL_QUERY)

    assert [h.name for h in hotels] == ["Snow Peak Lodge"]
    assert all(h.price_source == "estimated" for h in hotels)


def test_estimated_flights_are_always_labelled_estimated():
    claimed_live = FlightRecommendation(
        airline="Alliance Air",
        departure_airport="DEL",
        arrival_airport="KUU",
        price_per_traveler=7000,
        price_source="live",
    )
    search = EstimateSearch(
        FakeLLM({FlightRecommendations: FlightRecommendations(flights=[claimed_live])})
    )

    flights = search.search_flights(FLIGHT_QUERY)

    assert flights[0].airline == "Alliance Air"
    assert flights[0].price_source == "estimated"


def test_estimate_prompt_carries_destination_without_price_ceiling():
    def answer(prompt: str) -> HotelRecommendations:
        assert "Manali" in prompt and "3000" not in prompt
        return HotelRecommendations(hotels=[])

    assert EstimateSearch(FakeLLM({HotelRecommendations: answer})).search_hotels(HOTEL_QUERY) == []


class FakeWeb:
    def __init__(self, results=None, error=None):
        self._results = results or []
        self._error = error
        self.queries: list[str] = []

    def search(self, query: str):
        self.queries.append(query)
        if self._error:
            raise self._error
        return self._results


def test_web_fares_ground_the_flight_estimate():
    prompts = []

    def answer(prompt: str) -> FlightRecommendations:
        prompts.append(prompt)
        return FlightRecommendations(flights=[])

    web = FakeWeb([WebResult(title="Fares", url="https://f.example", content="From $300")])
    usd_flight = FlightQuery(
        origin_airport="LAX",
        destination_airport="JFK",
        outbound_date=date(2026, 12, 10),
        return_date=date(2026, 12, 12),
        max_price_per_traveler=400,
        currency="USD",
    )

    EstimateSearch(FakeLLM({FlightRecommendations: answer}), web).search_flights(usd_flight)

    assert web.queries == ["LAX to JFK round trip flight price December 2026 USD"]
    assert "From $300" in prompts[0]


def test_failed_web_search_still_estimates_flights():
    flight = FlightRecommendation(
        airline="Alliance Air",
        departure_airport="DEL",
        arrival_airport="KUU",
        price_per_traveler=7000,
    )
    search = EstimateSearch(
        FakeLLM({FlightRecommendations: FlightRecommendations(flights=[flight])}),
        FakeWeb(error=WebSearchError("quota")),
    )

    assert [f.airline for f in search.search_flights(FLIGHT_QUERY)] == ["Alliance Air"]
