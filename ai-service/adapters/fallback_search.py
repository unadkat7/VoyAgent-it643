import logging

from ports.search import FlightQuery, HotelQuery, SearchError
from schemas.recommendations import FlightRecommendation, HotelRecommendation

logger = logging.getLogger(__name__)


class FallbackSearch:
    """Use the live Provider; if it fails, use the fallback.

    No hotels is an answer. No flights usually means the Provider has no fares for the route
    or dates, so the fallback estimates them rather than leaving the Traveler with nothing.
    """

    def __init__(self, primary, fallback):
        self._primary = primary
        self._fallback = fallback

    def search_hotels(self, query: HotelQuery) -> list[HotelRecommendation]:
        return self._search("search_hotels", query)

    def search_flights(self, query: FlightQuery) -> list[FlightRecommendation]:
        try:
            found = self._primary.search_flights(query)
        except SearchError as error:
            logger.warning("Live search failed, using the fallback: %s", error)
            return self._fallback.search_flights(query)
        if found:
            return found
        logger.info("Live search found no flights, using the fallback")
        return self._fallback.search_flights(query)

    def _search(self, method: str, query):
        try:
            return getattr(self._primary, method)(query)
        except SearchError as error:
            logger.warning("Live search failed, using the fallback: %s", error)
            return getattr(self._fallback, method)(query)
