from dataclasses import dataclass
from typing import Protocol

from schemas.geo import GeoPoint, Region


class PlaceDetailsError(Exception):
    """Any place details Provider failure, including a paused quota."""


@dataclass(frozen=True)
class PlaceDetails:
    point: GeoPoint | None
    rating: float | None
    image_url: str | None
    maps_url: str | None


class PlaceDetailsPort(Protocol):
    def lookup(self, query: str, near: Region | None = None) -> PlaceDetails | None:
        """The real place behind an Activity's location, or None when nothing matches."""
        ...
