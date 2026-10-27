from datetime import date

from adapters.estimate_search import EstimateSearch
from schemas.recommendations import (
    FlightRecommendation,
    FlightRecommendations,
    HotelRecommendation,
    HotelRecommendations,
)
from ports.search import FlightQuery, HotelQuery
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
    search = EstimateSearch(FakeLLM({HotelRecommendations: HotelRecommendations(hotels=[claimed_live])}))

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
    search = EstimateSearch(FakeLLM({FlightRecommendations: FlightRecommendations(flights=[claimed_live])}))

    flights = search.search_flights(FLIGHT_QUERY)

    assert flights[0].airline == "Alliance Air"
    assert flights[0].price_source == "estimated"


def test_estimate_prompt_carries_destination_and_cap():
    def answer(prompt: str) -> HotelRecommendations:
        assert "Manali" in prompt and "3000" in prompt
        return HotelRecommendations(hotels=[])

    assert EstimateSearch(FakeLLM({HotelRecommendations: answer})).search_hotels(HOTEL_QUERY) == []
