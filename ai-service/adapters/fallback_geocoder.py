import logging
import time
from collections.abc import Callable

from ports.geocoder import GeocodeError, GeocoderPort
from schemas.geo import GeoPoint, Region

logger = logging.getLogger(__name__)

# After a primary failure, skip it for a while so every lookup doesn't wait for its timeout.
PRIMARY_COOLDOWN_SECONDS = 300.0


class FallbackGeocoder:
    """Tries a primary geocoder first (e.g. Wikipedia landmarks) and falls back to Nominatim."""

    def __init__(
        self,
        primary: GeocoderPort,
        fallback: GeocoderPort,
        *,
        cooldown_seconds: float = PRIMARY_COOLDOWN_SECONDS,
        clock: Callable[[], float] = time.monotonic,
    ):
        self._primary = primary
        self._fallback = fallback
        self._cooldown = cooldown_seconds
        self._clock = clock
        self._primary_down_until = float("-inf")

    def locate(self, query: str, near: Region | None = None) -> GeoPoint | None:
        point = self._ask_primary(query, near)
        # A primary hit outside the area is likely a namesake elsewhere, so let the fallback try.
        if point is not None and (near is None or near.contains(point)):
            return point
        return self._fallback.locate(query, near)

    def locate_area(self, query: str) -> Region | None:
        return self._fallback.locate_area(query)

    def _ask_primary(self, query: str, near: Region | None) -> GeoPoint | None:
        if self._clock() < self._primary_down_until:
            return None
        try:
            return self._primary.locate(query, near)
        except GeocodeError as error:
            logger.warning("Primary geocoder failed, pausing it: %s", error)
            self._primary_down_until = self._clock() + self._cooldown
            return None
