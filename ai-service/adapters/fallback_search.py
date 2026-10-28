import logging

from ports.search import FlightQuery, HotelQuery, SearchError
from schemas.recommendations import FlightRecommendation, HotelRecommendation

logger = logging.getLogger(__name__)


class FallbackSearch:
    """Use the live Provider; only if it fails, use the fallback. Empty is still an answer."""

    def __init__(self, primary, fallback):
        self._primary = primary
        self._fallback = fallback

    def search_hotels(self, query: HotelQuery) -> list[HotelRecommendation]:
        return self._search("search_hotels", query)

    def search_flights(self, query: FlightQuery) -> list[FlightRecommendation]:
        return self._search("search_flights", query)

    def _search(self, method: str, query):
        try:
            return getattr(self._primary, method)(query)
        except SearchError as error:
            logger.warning("Live search failed, using estimates: %s", error)
            return getattr(self._fallback, method)(query)
