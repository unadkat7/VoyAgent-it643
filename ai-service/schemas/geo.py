from math import asin, cos, radians, sin, sqrt

from pydantic import BaseModel, Field

EARTH_RADIUS_KM = 6371.0


class GeoPoint(BaseModel):
    """Coordinates of a place on the Trip Map, in WGS84 degrees."""

    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)


def distance_km(a: GeoPoint, b: GeoPoint) -> float:
    """Great-circle (haversine) distance."""
    dlat = radians(b.lat - a.lat)
    dlng = radians(b.lng - a.lng)
    h = sin(dlat / 2) ** 2 + cos(radians(a.lat)) * cos(radians(b.lat)) * sin(dlng / 2) ** 2
    return 2 * EARTH_RADIUS_KM * asin(sqrt(h))


class Region(BaseModel):
    """A circle around a place; radius_km covers its whole area (0 when the size is unknown)."""

    center: GeoPoint
    radius_km: float = Field(ge=0)

    def contains(self, point: GeoPoint) -> bool:
        return distance_km(self.center, point) <= self.radius_km
