from pydantic import BaseModel, Field


class GeoPoint(BaseModel):
    """A Location on the map, in WGS84 degrees."""

    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
