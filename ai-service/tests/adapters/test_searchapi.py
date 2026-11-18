from datetime import date

import httpx
import pytest
import respx

from adapters.searchapi import SearchApiSearch
from ports.search import FlightQuery, HotelQuery, SearchError
from schemas.geo import GeoPoint

URL = "https://www.searchapi.io/api/v1/search"

HOTEL_QUERY = HotelQuery(
    destination="Goa",
    check_in=date(2026, 12, 10),
    check_out=date(2026, 12, 13),
    adults=2,
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
            "price_per_night": {"price": "₹3,200", "extracted_price": 3200},
            "rating": 4.3,
            "hotel_class": "4-star hotel",
            "images": [{"thumbnail": "https://img.example/1.jpg"}],
            "amenities": ["Pool", "Free Wi-Fi"],
            "nearby_places": [{"name": "Calangute Beach"}],
            "gps_coordinates": {"latitude": 15.5439, "longitude": 73.7553},
        },
        {"name": "Mystery Inn"},
    ]
}

SEGMENT_AMD_BOM = {
    "airline": "IndiGo",
    "flight_number": "6E 101",
    "departure_airport": {"id": "AMD", "name": "Ahmedabad", "time": "07:00"},
    "arrival_airport": {"id": "BOM", "name": "Mumbai", "time": "08:15"},
}
SEGMENT_BOM_GOI = {
    "airline": "IndiGo",
    "flight_number": "6E 202",
    "departure_airport": {"id": "BOM", "name": "Mumbai", "time": "10:00"},
    "arrival_airport": {"id": "GOI", "name": "Goa", "time": "11:10"},
}
FLIGHTS_PAYLOAD = {
    "best_flights": [
        {
            "flights": [{**SEGMENT_AMD_BOM, "arrival_airport": SEGMENT_BOM_GOI["arrival_airport"]}],
            "total_duration": 125,
            "price": 5200,
        }
    ],
    "other_flights": [
        {"flights": [SEGMENT_AMD_BOM, SEGMENT_BOM_GOI], "total_duration": 250, "price": 4100}
    ],
}


def make_search() -> SearchApiSearch:
    return SearchApiSearch(api_key="search-key")


@respx.mock
def test_hotels_are_mapped_to_live_recommendations_and_unpriced_ones_skipped():
    respx.get(URL).respond(200, json=HOTELS_PAYLOAD)

    hotels = make_search().search_hotels(HOTEL_QUERY)

    assert len(hotels) == 1
    hotel = hotels[0]
    assert hotel.name == "Sea Breeze Resort"
    assert hotel.location == "Calangute Beach"
    assert hotel.price_per_night == 3200
    assert hotel.currency == "INR"
    assert hotel.rating == 4.3
    assert hotel.booking_url == "https://hotels.example/sea-breeze"
    assert hotel.image_url == "https://img.example/1.jpg"
    assert hotel.price_source == "live"
    assert hotel.coordinates == GeoPoint(lat=15.5439, lng=73.7553)


@respx.mock
def test_hotel_without_gps_has_no_coordinates():
    item = {k: v for k, v in HOTELS_PAYLOAD["properties"][0].items() if k != "gps_coordinates"}
    respx.get(URL).respond(200, json={"properties": [item]})

    assert make_search().search_hotels(HOTEL_QUERY)[0].coordinates is None


@respx.mock
def test_hotel_request_asks_for_inr_prices_without_a_price_cap():
    route = respx.get(URL).respond(200, json={"properties": []})

    make_search().search_hotels(HOTEL_QUERY)

    params = route.calls.last.request.url.params
    assert route.calls.last.request.headers["authorization"] == "Bearer search-key"
    assert params["engine"] == "google_hotels"
    assert "Goa" in params["q"]
    assert params["check_in_date"] == "2026-12-10"
    assert params["check_out_date"] == "2026-12-13"
    assert params["currency"] == "INR"
    # No cap at the Provider: the planner must see over-budget results to say "raise the Budget".
    assert "price_max" not in params


@respx.mock
def test_flights_from_both_lists_are_mapped_with_stops_and_duration():
    respx.get(URL).respond(200, json=FLIGHTS_PAYLOAD)

    flights = make_search().search_flights(FLIGHT_QUERY)

    assert [f.price_per_traveler for f in flights] == [5200, 4100]
    direct, one_stop = flights
    assert direct.stops == 0
    assert direct.duration == "2h 5m"
    assert one_stop.stops == 1
    assert one_stop.departure_airport == "Ahmedabad (AMD)"
    assert one_stop.arrival_airport == "Goa (GOI)"
    assert one_stop.airline == "IndiGo"
    assert all(f.price_source == "live" for f in flights)


@respx.mock
def test_flight_request_prices_one_traveler_round_trip():
    route = respx.get(URL).respond(200, json={})

    make_search().search_flights(FLIGHT_QUERY)

    params = route.calls.last.request.url.params
    assert params["engine"] == "google_flights"
    assert params["departure_id"] == "AMD"
    assert params["arrival_id"] == "GOI"
    assert params["outbound_date"] == "2026-12-10"
    assert params["return_date"] == "2026-12-13"
    assert params["flight_type"] == "round_trip"
    assert params["adults"] == "1"
    assert "max_price" not in params


@pytest.mark.parametrize("status", [401, 429, 500, 503])
@respx.mock
def test_provider_errors_become_search_errors(status):
    respx.get(URL).respond(status, json={"error": "nope"})

    with pytest.raises(SearchError):
        make_search().search_hotels(HOTEL_QUERY)


@respx.mock
def test_network_failure_becomes_search_error():
    respx.get(URL).mock(side_effect=httpx.ReadTimeout("slow"))

    with pytest.raises(SearchError):
        make_search().search_flights(FLIGHT_QUERY)
