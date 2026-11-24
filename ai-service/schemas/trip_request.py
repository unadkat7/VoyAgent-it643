from typing import Literal

from pydantic import BaseModel, Field

PlaceKind = Literal["city", "region", "country", "multi_country", "not_on_earth", "not_a_place"]
WorldArea = Literal[
    "india",
    "south_asia",
    "southeast_asia",
    "east_asia",
    "middle_east",
    "europe",
    "africa",
    "americas",
    "oceania",
    "polar",
]


class TripRequest(BaseModel):
    """What the Planning Engine understood from the Traveler's Conversation. Money is INR."""

    origin: str | None = Field(None, description="City the Travel Party starts from")
    destination: str | None = Field(None, description="Main city or region to visit")
    duration_days: int | None = Field(None, description="Number of days of the Trip")
    nights: int | None = Field(
        None, description="Hotel nights, only if stated (e.g. 3D/2N or '2 nights' = 2)"
    )
    budget: int | None = Field(None, description="Total Budget in INR for the whole Travel Party")
    party_size: int | None = Field(None, description="Number of Travelers in the Travel Party")
    travel_style: str | None = Field(None, description="e.g. budget, luxury, adventure, family")
    start_date: str | None = Field(None, description="First day as YYYY-MM-DD, if stated")
    interests: list[str] = Field(default_factory=list)
    accommodation_type: str | None = Field(None, description="e.g. resort, hostel, if stated")
    special_requests: list[str] = Field(default_factory=list)
    destination_kind: PlaceKind | None = Field(
        None, description="Geographic type of destination, including invalid names"
    )
    destination_area: WorldArea | None = Field(None, description="World area of the destination")
    origin_kind: PlaceKind | None = Field(None, description="Geographic type of the starting place")
