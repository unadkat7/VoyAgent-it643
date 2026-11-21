from pydantic import BaseModel, Field


class GeoPoint(BaseModel):
    """Coordinates of a place on the Trip Map, in WGS84 degrees."""

    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
