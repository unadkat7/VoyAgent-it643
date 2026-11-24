from typing import Any

from adapters.searchapi import MAX_HOTEL_ADULTS, _to_flight, _to_point
from adapters.serpapi_client import SerpApiClient, SerpApiError
from ports.search import FlightQuery, HotelQuery, SearchError
from schemas.recommendations import FlightRecommendation, HotelRecommendation

ROUND_TRIP, ONE_WAY = 1, 2


class SerpApiSearch:
    """Live Provider: SerpAPI google_hotels and google_flights.

    Same shape as SearchApi.io's engines; used as its backup to save the small SerpAPI plan.
    """

    def __init__(self, client: SerpApiClient):
        self._client = client

    def search_hotels(self, query: HotelQuery) -> list[HotelRecommendation]:
        payload = self._get(
            {
                "engine": "google_hotels",
                "q": f"{query.accommodation_type or 'hotels'} in {query.destination}",
                "check_in_date": query.check_in.isoformat(),
                "check_out_date": query.check_out.isoformat(),
                "adults": min(query.adults, MAX_HOTEL_ADULTS),
                "currency": query.currency,
                **({"gl": query.country} if query.country else {}),
                "hl": "en",
            }
        )
        properties = payload.get("properties") or []
        return [
            hotel
            for item in properties
            if (hotel := _to_hotel(item, query.destination, query.currency)) is not None
        ]

    def search_flights(self, query: FlightQuery) -> list[FlightRecommendation]:
        # One adult, so the fare is per Traveler; the planner multiplies by party size.
        payload = self._get(
            {
                "engine": "google_flights",
                "departure_id": query.origin_airport,
                "arrival_id": query.destination_airport,
                "outbound_date": query.outbound_date.isoformat(),
                **({"return_date": query.return_date.isoformat()} if query.return_date else {}),
                "type": ROUND_TRIP if query.return_date else ONE_WAY,
                "adults": 1,
                "currency": query.currency,
                **({"gl": query.country} if query.country else {}),
                "hl": "en",
            }
        )
        options = (payload.get("best_flights") or []) + (payload.get("other_flights") or [])
        return [
            flight
            for item in options
            if (flight := _to_flight(item, query.currency)) is not None
        ]

    def _get(self, params: dict[str, Any]) -> dict[str, Any]:
        try:
            return self._client.get(params, feature="search")
        except SerpApiError as error:
            raise SearchError(str(error)) from error


def _to_hotel(
    item: dict[str, Any], destination: str, currency: str = "INR"
) -> HotelRecommendation | None:
    price = (item.get("rate_per_night") or {}).get("extracted_lowest")
    if not price or not item.get("name"):
        return None
    nearby = item.get("nearby_places") or []
    images = item.get("images") or []
    return HotelRecommendation(
        name=item["name"],
        location=nearby[0].get("name", destination) if nearby else destination,
        price_per_night=float(price),
        currency=currency,
        rating=item.get("overall_rating"),
        hotel_class=item.get("hotel_class"),
        booking_url=item.get("link"),
        image_url=images[0].get("thumbnail") if images else None,
        amenities=item.get("amenities") or [],
        price_source="live",
        coordinates=_to_point(item.get("gps_coordinates")),
    )
