from dataclasses import dataclass
from datetime import date
from typing import Protocol

from schemas.recommendations import FlightRecommendation, HotelRecommendation


class SearchError(Exception):
    """Any search Provider failure (quota, network, bad response)."""


@dataclass(frozen=True)
class HotelQuery:
    destination: str
    check_in: date
    check_out: date
    adults: int
    max_price_per_night: int
    travel_style: str | None
    accommodation_type: str | None


@dataclass(frozen=True)
class FlightQuery:
    origin_airport: str
    destination_airport: str
    outbound_date: date
    return_date: date | None
    max_price_per_traveler: int


class HotelSearchPort(Protocol):
    def search_hotels(self, query: HotelQuery) -> list[HotelRecommendation]: ...


class FlightSearchPort(Protocol):
    def search_flights(self, query: FlightQuery) -> list[FlightRecommendation]: ...
