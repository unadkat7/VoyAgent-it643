from typing import Protocol

from schemas.geo import GeoPoint, Region


class GeocodeError(Exception):
    """Any geocoding Provider failure (rate limit, network, bad response)."""


class GeocoderPort(Protocol):
    def locate(self, query: str, near: Region | None = None) -> GeoPoint | None:
        """The best match for a place name, or None. `near` is a hint; callers still check it."""
        ...

    def locate_area(self, query: str) -> Region | None:
        """A place with a radius covering its whole area (a city, state or country), or None."""
        ...
