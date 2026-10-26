from pydantic import BaseModel, Field


class Activity(BaseModel):
    time: str = Field(description="Morning, Afternoon or Evening, or a time like 09:00")
    title: str
    description: str
    location: str
    estimated_cost: float = Field(0, ge=0, description="Estimated Cost in INR per Traveler")


class ItineraryDay(BaseModel):
    day: int = Field(ge=1)
    title: str
    activities: list[Activity]


class Itinerary(BaseModel):
    days: list[ItineraryDay]
