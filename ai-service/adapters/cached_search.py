import time
from collections.abc import Callable

from ports.search import FlightQuery, HotelQuery
from schemas.recommendations import FlightRecommendation, HotelRecommendation


class CachedSearch:
    """Remembers answers per query for a while, to save the small SearchApi.io quota."""

    def __init__(self, inner, *, ttl_seconds: float, clock: Callable[[], float] = time.monotonic):
        self._inner = inner
        self._ttl = ttl_seconds
        self._clock = clock
        self._entries: dict[tuple[str, object], tuple[float, list]] = {}

    def search_hotels(self, query: HotelQuery) -> list[HotelRecommendation]:
        return self._cached("search_hotels", query)

    def search_flights(self, query: FlightQuery) -> list[FlightRecommendation]:
        return self._cached("search_flights", query)

    def _cached(self, method: str, query):
        key = (method, query)
        hit = self._entries.get(key)
        if hit and self._clock() < hit[0]:
            return hit[1]
        answer = getattr(self._inner, method)(query)
        self._entries[key] = (self._clock() + self._ttl, answer)
        return answer
