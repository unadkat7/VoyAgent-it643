from pydantic import BaseModel, Field
from pydantic.json_schema import SkipJsonSchema

from schemas.geo import GeoPoint


class Activity(BaseModel):
    time: str = Field(description="Morning, Afternoon or Evening, or a time like 09:00")
    title: str
    description: str
    location: str
    estimated_cost: float = Field(
        0, ge=0, description="Estimated Cost per Traveler in the Trip currency"
    )
    # Filled by the locate step; hidden from the LLM's schema so it never invents pins or ratings.
    coordinates: SkipJsonSchema[GeoPoint | None] = None
    rating: SkipJsonSchema[float | None] = None
    image_url: SkipJsonSchema[str | None] = None
    maps_url: SkipJsonSchema[str | None] = None


class ItineraryDay(BaseModel):
    stop: int | None = Field(None, ge=0, description="Zero-based index of the base city")
    day: int = Field(ge=1)
    title: str
    activities: list[Activity]


class Itinerary(BaseModel):
    days: list[ItineraryDay]
