from pydantic import BaseModel, Field


class TripRequest(BaseModel):
    """What the Planning Engine understood from the Traveler's Conversation. Money is INR."""

    origin: str | None = Field(None, description="City the Travel Party starts from")
    destination: str | None = Field(None, description="Main city or region to visit")
    duration_days: int | None = Field(None, description="Number of days of the Trip")
    budget: int | None = Field(None, description="Total Budget in INR for the whole Travel Party")
    party_size: int | None = Field(None, description="Number of Travelers in the Travel Party")
    travel_style: str | None = Field(None, description="e.g. budget, luxury, adventure, family")
    start_date: str | None = Field(None, description="First day as YYYY-MM-DD, if stated")
    interests: list[str] = Field(default_factory=list)
    accommodation_type: str | None = Field(None, description="e.g. resort, hostel, if stated")
    special_requests: list[str] = Field(default_factory=list)
