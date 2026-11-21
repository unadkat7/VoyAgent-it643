from typing import Protocol

from schemas.geo import GeoPoint


class GeocodeError(Exception):
    """Any geocoding Provider failure (rate limit, network, bad response)."""


class GeocoderPort(Protocol):
    def locate(self, query: str) -> GeoPoint | None:
        """The best match for a place name, or None when nothing matches."""
        ...
