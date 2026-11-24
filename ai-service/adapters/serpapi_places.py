import time
from collections.abc import Callable
from typing import Any
from urllib.parse import urlencode

from adapters.searchapi import _to_point
from adapters.serpapi_client import SerpApiClient, SerpApiError
from ports.place_details import PlaceDetails, PlaceDetailsError
from schemas.geo import Region

MAPS_SEARCH_URL = "https://www.google.com/maps/search/?"
CACHE_SECONDS = 6 * 60 * 60


class SerpApiPlaces:
    """Place details Provider: SerpAPI google_maps. Answers are kept a while to save the plan."""

    def __init__(
        self,
        client: SerpApiClient,
        *,
        cache_seconds: float = CACHE_SECONDS,
        clock: Callable[[], float] = time.monotonic,
    ):
        self._client = client
        self._cache_seconds = cache_seconds
        self._clock = clock
        self._cache: dict[str, tuple[float, PlaceDetails | None]] = {}

    def lookup(self, query: str, near: Region | None = None) -> PlaceDetails | None:
        hit = self._cache.get(query)
        if hit and self._clock() < hit[0]:
            return hit[1]
        params: dict[str, Any] = {"engine": "google_maps", "type": "search", "q": query, "hl": "en"}
        if near is not None:
            params["ll"] = f"@{near.center.lat},{near.center.lng},12z"
        try:
            payload = self._client.get(params, feature="places")
        except SerpApiError as error:
            raise PlaceDetailsError(str(error)) from error
        # An exact match comes back as place_results; a vaguer query as a list.
        place = payload.get("place_results") or next(iter(payload.get("local_results") or []), None)
        details = _to_details(place) if place else None
        self._cache[query] = (self._clock() + self._cache_seconds, details)
        return details


def _to_details(place: dict[str, Any]) -> PlaceDetails | None:
    title = place.get("title")
    if not title:
        return None
    query = {"api": 1, "query": title}
    if place.get("place_id"):
        query["query_place_id"] = place["place_id"]
    rating = place.get("rating")
    return PlaceDetails(
        point=_to_point(place.get("gps_coordinates")),
        rating=float(rating) if rating else None,
        image_url=place.get("thumbnail"),
        maps_url=MAPS_SEARCH_URL + urlencode(query),
    )
