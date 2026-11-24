from dataclasses import replace
from datetime import date
from typing import Any

import pytest

from adapters.serpapi import SerpApiSearch
from adapters.serpapi_client import SerpApiError
from adapters.serpapi_web import SerpApiWebSearch
from ports.search import FlightQuery, HotelQuery, SearchError
from ports.web_search import WebResult, WebSearchError
from schemas.geo import GeoPoint


class FakeClient:
    def __init__(self, payload: dict[str, Any] | None = None, error: bool = False):
        self.payload = payload or {}
        self.error = error
        self.calls: list[tuple[dict[str, Any], str]] = []

    def get(self, params: dict[str, Any], *, feature: str) -> dict[str, Any]:
        self.calls.append((params, feature))
        if self.error:
            raise SerpApiError("SerpAPI search paused: 2 searches left this month")
        return self.payload


HOTEL_QUERY = HotelQuery(
    destination="Goa",
    check_in=date(2026, 12, 10),
    check_out=date(2026, 12, 13),
    adults=8,
    max_price_per_night=4000,
    travel_style="relaxed",
    accommodation_type=None,
)
FLIGHT_QUERY = FlightQuery(
    origin_airport="AMD",
    destination_airport="GOI",
    outbound_date=date(2026, 12, 10),
    return_date=date(2026, 12, 13),
    max_price_per_traveler=6000,
)

HOTELS_PAYLOAD = {
    "properties": [
        {
            "name": "Sea Breeze Resort",
            "link": "https://hotels.example/sea-breeze",
            "rate_per_night": {"lowest": "₹3,200", "extracted_lowest": 3200},
            "overall_rating": 4.3,
            "hotel_class": "4-star hotel",
            "images": [{"thumbnail": "https://img.example/1.jpg"}],
            "amenities": ["Pool"],
            "nearby_places": [{"name": "Calangute Beach"}],
            "gps_coordinates": {"latitude": 15.5439, "longitude": 73.7553},
        },
        {"name": "Mystery Inn"},
    ]
}
FLIGHTS_PAYLOAD = {
    "best_flights": [
        {
            "flights": [
                {
                    "airline": "IndiGo",
                    "flight_number": "6E 101",
                    "departure_airport": {"id": "AMD", "name": "Ahmedabad", "time": "07:00"},
                    "arrival_airport": {"id": "GOI", "name": "Goa", "time": "09:05"},
                }
            ],
            "total_duration": 125,
            "price": 5200,
        }
    ],
    "other_flights": [{"flights": [], "price": 100}],
}


def test_hotels_are_mapped_from_serpapi_fields_and_unpriced_ones_skipped():
    hotels = SerpApiSearch(FakeClient(HOTELS_PAYLOAD)).search_hotels(HOTEL_QUERY)

    assert len(hotels) == 1
    hotel = hotels[0]
    assert hotel.name == "Sea Breeze Resort"
    assert hotel.location == "Calangute Beach"
    assert hotel.price_per_night == 3200
    assert hotel.rating == 4.3
    assert hotel.image_url == "https://img.example/1.jpg"
    assert hotel.price_source == "live"
    assert hotel.coordinates == GeoPoint(lat=15.5439, lng=73.7553)


def test_hotel_request_asks_for_trip_currency_and_region_without_a_price_cap():
    client = FakeClient(HOTELS_PAYLOAD)
    query = replace(HOTEL_QUERY, currency="USD", country="us")

    hotels = SerpApiSearch(client).search_hotels(query)

    params, feature = client.calls[0]
    assert feature == "search"
    assert params["engine"] == "google_hotels"
    assert params["currency"] == "USD"
    assert params["gl"] == "us"
    assert params["adults"] == 6
    assert "max_price" not in params
    assert hotels[0].currency == "USD"


def test_flights_are_mapped_and_empty_options_skipped():
    query = replace(FLIGHT_QUERY, currency="USD", country="us")
    client = FakeClient(FLIGHTS_PAYLOAD)

    flights = SerpApiSearch(client).search_flights(query)

    params, _ = client.calls[0]
    assert params["currency"] == "USD"
    assert params["gl"] == "us"
    assert len(flights) == 1
    assert flights[0].price_per_traveler == 5200
    assert flights[0].currency == "USD"
    assert flights[0].duration == "2h 5m"
    assert flights[0].arrival_airport == "Goa (GOI)"


@pytest.mark.parametrize(("return_date", "flight_type"), [(date(2026, 12, 13), 1), (None, 2)])
def test_flight_request_uses_serpapi_trip_type(return_date, flight_type):
    client = FakeClient()
    query = replace(FLIGHT_QUERY, return_date=return_date)

    SerpApiSearch(client).search_flights(query)

    params, _ = client.calls[0]
    assert params["type"] == flight_type
    assert params["adults"] == 1
    assert ("return_date" in params) is (return_date is not None)


def test_client_refusal_becomes_search_error():
    with pytest.raises(SearchError):
        SerpApiSearch(FakeClient(error=True)).search_hotels(HOTEL_QUERY)


def test_web_results_with_snippets_are_returned_top_five():
    organic = [
        {"title": f"Fare {i}", "link": f"https://fares.example/{i}", "snippet": f"₹{i}00"}
        for i in range(7)
    ]
    client = FakeClient({"organic_results": [{"title": "No snippet", "link": "x"}, *organic]})

    results = SerpApiWebSearch(client).search("12951 train fare Mumbai to Delhi")

    assert results[0] == WebResult(title="Fare 0", url="https://fares.example/0", content="₹000")
    assert len(results) == 5
    params, feature = client.calls[0]
    assert feature == "web"
    assert params == {
        "engine": "google",
        "q": "12951 train fare Mumbai to Delhi",
        "hl": "en",
    }

    SerpApiWebSearch(client).search("12951 train fare Mumbai to Delhi", gl="us")
    assert client.calls[1][0]["gl"] == "us"


def test_web_refusal_becomes_web_search_error():
    with pytest.raises(WebSearchError):
        SerpApiWebSearch(FakeClient(error=True)).search("fares")
