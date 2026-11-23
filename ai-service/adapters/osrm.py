import threading
import time
from collections.abc import Callable

import httpx

from domain.roads import Drive
from ports.roads import RouteError
from schemas.geo import GeoPoint

OSRM_URL = "https://router.project-osrm.org"
USER_AGENT = "VoyAgent/1.0 (trip planner)"
# The public OSRM server is shared; one request a second keeps us within fair use.
MIN_INTERVAL_SECONDS = 1.0


class OsrmRouter:
    """Free OpenStreetMap car routing. Answers are cached for the process: roads rarely move."""

    def __init__(
        self,
        *,
        base_url: str = OSRM_URL,
        timeout_seconds: float = 10.0,
        clock: Callable[[], float] = time.monotonic,
        sleep: Callable[[float], None] = time.sleep,
    ):
        self._url = f"{base_url.rstrip('/')}/route/v1/driving"
        self._timeout = timeout_seconds
        self._clock = clock
        self._sleep = sleep
        self._lock = threading.Lock()
        self._last_request: float | None = None
        self._cache: dict[str, Drive | None] = {}

    def drive(self, start: GeoPoint, end: GeoPoint) -> Drive | None:
        # OSRM takes longitude first.
        path = f"{start.lng},{start.lat};{end.lng},{end.lat}"
        with self._lock:
            if path not in self._cache:
                self._wait_for_turn()
                self._cache[path] = self._fetch(path)
            return self._cache[path]

    def _wait_for_turn(self) -> None:
        if self._last_request is not None:
            wait = MIN_INTERVAL_SECONDS - (self._clock() - self._last_request)
            if wait > 0:
                self._sleep(wait)
        self._last_request = self._clock()

    def _fetch(self, path: str) -> Drive | None:
        try:
            response = httpx.get(
                f"{self._url}/{path}",
                params={"overview": "false"},
                headers={"User-Agent": USER_AGENT},
                timeout=self._timeout,
            )
            if response.status_code == 400 and response.json().get("code") == "NoRoute":
                return None
            response.raise_for_status()
            body = response.json()
            route = body["routes"][0]
            return Drive(
                km=route["distance"] / 1000,
                hours=round(route["duration"] / 3600, 1),
                end_gap_km=body["waypoints"][-1]["distance"] / 1000,
            )
        except (httpx.HTTPError, ValueError, KeyError, TypeError, IndexError) as error:
            raise RouteError(f"OSRM failed for {path}: {error}") from error
