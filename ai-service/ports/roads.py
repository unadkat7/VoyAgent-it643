from typing import Protocol

from domain.roads import Drive
from schemas.geo import GeoPoint


class RouteError(Exception):
    """Any routing Provider failure (rate limit, network, bad response)."""


class RouterPort(Protocol):
    def drive(self, start: GeoPoint, end: GeoPoint) -> Drive | None:
        """A car route, or None when no road joins the two places. Raises RouteError."""
        ...
