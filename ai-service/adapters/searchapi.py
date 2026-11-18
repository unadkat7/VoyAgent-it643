from typing import Any

import httpx

from ports.search import FlightQuery, HotelQuery, SearchError
from schemas.geo import GeoPoint
from schemas.recommendations import FlightRecommendation, HotelRecommendation

SEARCHAPI_URL = "https://www.searchapi.io/api/v1/search"
MAX_HOTEL_ADULTS = 6


class SearchApiSearch:
    """Live Provider: SearchApi.io google_hotels and google_flights engines, priced in INR.

    Budget caps are applied by the planner, not sent here, so over-budget results stay visible.
    """

    def __init__(self, *, api_key: str, timeout_seconds: float = 45.0):
        self._api_key = api_key
        self._timeout = timeout_seconds

    def search_hotels(self, query: HotelQuery) -> list[HotelRecommendation]:
        payload = self._get(
            {
                "engine": "google_hotels",
                "q": f"{query.accommodation_type or 'hotels'} in {query.destination}",
                "check_in_date": query.check_in.isoformat(),
                "check_out_date": query.check_out.isoformat(),
                "adults": min(query.adults, MAX_HOTEL_ADULTS),
                "currency": "INR",
                "gl": "in",
                "hl": "en",
            }
        )
        properties = payload.get("properties") or []
        return [
            hotel
            for item in properties
            if (hotel := _to_hotel(item, query.destination)) is not None
        ]

    def search_flights(self, query: FlightQuery) -> list[FlightRecommendation]:
        # One adult, so the fare is per Traveler; the planner multiplies by party size.
        payload = self._get(
            {
                "engine": "google_flights",
                "departure_id": query.origin_airport,
                "arrival_id": query.destination_airport,
                "outbound_date": query.outbound_date.isoformat(),
                "return_date": query.return_date.isoformat(),
                "flight_type": "round_trip",
                "adults": 1,
                "currency": "INR",
                "gl": "in",
                "hl": "en",
            }
        )
        options = (payload.get("best_flights") or []) + (payload.get("other_flights") or [])
        return [flight for item in options if (flight := _to_flight(item)) is not None]

    def _get(self, params: dict[str, Any]) -> dict[str, Any]:
        try:
            response = httpx.get(
                SEARCHAPI_URL,
                params=params,
                headers={"Authorization": f"Bearer {self._api_key}"},
                timeout=self._timeout,
            )
            response.raise_for_status()
            return response.json()
        except (httpx.HTTPError, ValueError) as error:
            raise SearchError(f"SearchApi.io {params['engine']} failed: {error}") from error


def _to_hotel(item: dict[str, Any], destination: str) -> HotelRecommendation | None:
    price = (item.get("price_per_night") or {}).get("extracted_price")
    if not price or not item.get("name"):
        return None
    nearby = item.get("nearby_places") or []
    images = item.get("images") or []
    return HotelRecommendation(
        name=item["name"],
        location=nearby[0].get("name", destination) if nearby else destination,
        price_per_night=float(price),
        rating=item.get("rating"),
        hotel_class=item.get("hotel_class"),
        booking_url=item.get("link"),
        image_url=images[0].get("thumbnail") if images else None,
        amenities=item.get("amenities") or [],
        price_source="live",
        coordinates=_to_point(item.get("gps_coordinates")),
    )


def _to_point(gps: dict[str, Any] | None) -> GeoPoint | None:
    try:
        return GeoPoint(lat=gps["latitude"], lng=gps["longitude"])
    except (TypeError, KeyError, ValueError):
        return None


def _to_flight(item: dict[str, Any]) -> FlightRecommendation | None:
    segments = item.get("flights") or []
    price = item.get("price")
    if not segments or not price:
        return None
    first, last = segments[0], segments[-1]
    departure = first.get("departure_airport") or {}
    arrival = last.get("arrival_airport") or {}
    return FlightRecommendation(
        airline=first.get("airline", "Unknown airline"),
        flight_number=first.get("flight_number"),
        departure_airport=_airport_label(departure),
        arrival_airport=_airport_label(arrival),
        departure_time=departure.get("time"),
        arrival_time=arrival.get("time"),
        duration=_duration_label(item.get("total_duration")),
        price_per_traveler=float(price),
        stops=len(segments) - 1,
        price_source="live",
    )


def _airport_label(airport: dict[str, Any]) -> str:
    name, code = airport.get("name"), airport.get("id")
    if name and code:
        return f"{name} ({code})"
    return name or code or "Unknown airport"


def _duration_label(minutes: int | None) -> str | None:
    if not minutes:
        return None
    return f"{minutes // 60}h {minutes % 60}m"
