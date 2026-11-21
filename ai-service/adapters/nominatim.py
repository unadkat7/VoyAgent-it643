import threading
import time
from collections.abc import Callable

import httpx

from ports.geocoder import GeocodeError
from schemas.geo import GeoPoint

NOMINATIM_URL = "https://nominatim.openstreetmap.org"
USER_AGENT = "VoyAgent/1.0 (trip planner)"
# Nominatim's usage policy allows at most one request per second.
MIN_INTERVAL_SECONDS = 1.0


class NominatimGeocoder:
    """Free OpenStreetMap geocoder. Answers are cached for the process: places don't move."""

    def __init__(
        self,
        *,
        base_url: str = NOMINATIM_URL,
        timeout_seconds: float = 10.0,
        clock: Callable[[], float] = time.monotonic,
        sleep: Callable[[float], None] = time.sleep,
    ):
        self._url = f"{base_url.rstrip('/')}/search"
        self._timeout = timeout_seconds
        self._clock = clock
        self._sleep = sleep
        self._lock = threading.Lock()
        self._last_request: float | None = None
        self._cache: dict[str, GeoPoint | None] = {}

    def locate(self, query: str) -> GeoPoint | None:
        with self._lock:
            if query in self._cache:
                return self._cache[query]
            self._wait_for_turn()
            point = self._fetch(query)
            self._cache[query] = point
            return point

    def _wait_for_turn(self) -> None:
        if self._last_request is not None:
            wait = MIN_INTERVAL_SECONDS - (self._clock() - self._last_request)
            if wait > 0:
                self._sleep(wait)
        self._last_request = self._clock()

    def _fetch(self, query: str) -> GeoPoint | None:
        try:
            response = httpx.get(
                self._url,
                params={"q": query, "format": "jsonv2", "limit": 1},
                headers={"User-Agent": USER_AGENT},
                timeout=self._timeout,
            )
            response.raise_for_status()
            matches = response.json()
            if not matches:
                return None
            return GeoPoint(lat=float(matches[0]["lat"]), lng=float(matches[0]["lon"]))
        except (httpx.HTTPError, ValueError, KeyError, TypeError) as error:
            raise GeocodeError(f"Nominatim failed for {query!r}: {error}") from error
