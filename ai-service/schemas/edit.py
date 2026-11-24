from pydantic import BaseModel, Field

from schemas.trip_request import TripRequest


class PlanEdit(BaseModel):
    """What the LLM read from a chat message about a plan. Code decides what to re-run."""

    changes: TripRequest = Field(
        default_factory=TripRequest,
        description="Only the Trip Request fields the Traveler wants changed; all others null",
    )
    itinerary_change: str | None = Field(
        None, description="What to change in the day plan, e.g. 'replace day 2 with Dudhsagar'"
    )
    answer: str | None = Field(
        None, description="A short reply when the Traveler asks a question or wants suggestions"
    )
    off_topic: bool = False
