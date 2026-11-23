import threading
import time
from collections.abc import Callable

import httpx

from domain.places import PlaceMatch
from ports.geocoder import GeocodeError
from schemas.geo import GeoPoint, Region, distance_km

NOMINATIM_URL = "https://nominatim.openstreetmap.org"
USER_AGENT = "VoyAgent/1.0 (trip planner)"
# Nominatim's usage policy allows at most one request per second.
MIN_INTERVAL_SECONDS = 1.0
MAX_SETTLEMENTS = 5
PLACE_KINDS = {"city", "town", "village", "hamlet"}
REGION_TYPES = {"state", "state_district", "county", "district", "region", "province"}


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
        self._cache: dict[str, Region | None] = {}
        self._settlements: dict[str, list[PlaceMatch]] = {}

    def find_settlements(self, name: str) -> list[PlaceMatch]:
        """Settlements (towns, cities, regions) in India only, so a temple or shop can't match."""
        with self._lock:
            if name not in self._settlements:
                self._wait_for_turn()
                self._settlements[name] = self._fetch_settlements(name)
            return self._settlements[name]

    def _fetch_settlements(self, name: str) -> list[PlaceMatch]:
        try:
            response = httpx.get(
                self._url,
                params={
                    "q": name,
                    "format": "jsonv2",
                    "limit": MAX_SETTLEMENTS,
                    "countrycodes": "in",
                    "featureType": "settlement",
                },
                headers={"User-Agent": USER_AGENT},
                timeout=self._timeout,
            )
            response.raise_for_status()
            return [_place_match(match, name) for match in response.json()]
        except (httpx.HTTPError, ValueError, KeyError, TypeError) as error:
            raise GeocodeError(f"Nominatim failed for {name!r}: {error}") from error

    def locate(self, query: str, near: Region | None = None) -> GeoPoint | None:
        area = self.locate_area(query)
        return area.center if area else None

    def locate_area(self, query: str) -> Region | None:
        with self._lock:
            if query in self._cache:
                return self._cache[query]
            self._wait_for_turn()
            area = self._fetch(query)
            self._cache[query] = area
            return area

    def _wait_for_turn(self) -> None:
        if self._last_request is not None:
            wait = MIN_INTERVAL_SECONDS - (self._clock() - self._last_request)
            if wait > 0:
                self._sleep(wait)
        self._last_request = self._clock()

    def _fetch(self, query: str) -> Region | None:
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
            match = matches[0]
            center = GeoPoint(lat=float(match["lat"]), lng=float(match["lon"]))
            return Region(center=center, radius_km=_radius_km(center, match.get("boundingbox")))
        except (httpx.HTTPError, ValueError, KeyError, TypeError) as error:
            raise GeocodeError(f"Nominatim failed for {query!r}: {error}") from error


def _place_match(match: dict, asked: str) -> PlaceMatch:
    point = GeoPoint(lat=float(match["lat"]), lng=float(match["lon"]))
    return PlaceMatch(
        name=match.get("name") or asked,
        point=point,
        radius_km=_radius_km(point, match.get("boundingbox")),
        importance=float(match.get("importance") or 0),
        kind=_kind(match.get("category"), match.get("type")),
    )


def _kind(category: str | None, place_type: str | None) -> str:
    if category == "place" and place_type in PLACE_KINDS:
        return place_type
    if category == "boundary" or place_type in REGION_TYPES:
        return "region"
    return "hamlet"


def _radius_km(center: GeoPoint, box: list[str] | None) -> float:
    # Nominatim's boundingbox is [south, north, west, east]; the farthest corner covers the area.
    if not box:
        return 0.0
    south, north, west, east = (float(edge) for edge in box)
    corners = [GeoPoint(lat=lat, lng=lng) for lat in (south, north) for lng in (west, east)]
    return max(distance_km(center, corner) for corner in corners)
