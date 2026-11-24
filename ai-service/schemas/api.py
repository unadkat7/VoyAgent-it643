from typing import Literal

from pydantic import BaseModel, Field, field_validator

from schemas.plan import TripPlan


class ConversationTurn(BaseModel):
    role: Literal["traveler", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class PlanTripRequest(BaseModel):
    trip_id: str = Field(min_length=1, max_length=64)
    conversation: list[ConversationTurn] = Field(min_length=1, max_length=40)

    @field_validator("conversation")
    @classmethod
    def last_turn_is_from_traveler(cls, turns: list[ConversationTurn]) -> list[ConversationTurn]:
        if turns[-1].role != "traveler":
            raise ValueError("the last turn must come from the traveler")
        return turns


RejectionReason = Literal["not_a_place", "not_on_earth", "unreachable", "off_topic"]


class Clarification(BaseModel):
    missing_fields: list[str]
    question: str
    reason: RejectionReason | None = None


class PlanTripResponse(BaseModel):
    status: Literal["needs_clarification", "planned"]
    trip_id: str
    clarification: Clarification | None = None
    plan: TripPlan | None = None


class EditPlanRequest(BaseModel):
    """A chat message about a finished plan: the plan as it is now, and the recent Conversation."""

    trip_id: str = Field(min_length=1, max_length=64)
    conversation: list[ConversationTurn] = Field(min_length=1, max_length=40)
    plan: TripPlan
    travel_mode: Literal["flight", "train", "bus", "car"] | None = None

    @field_validator("conversation")
    @classmethod
    def last_turn_is_from_traveler(cls, turns: list[ConversationTurn]) -> list[ConversationTurn]:
        if turns[-1].role != "traveler":
            raise ValueError("the last turn must come from the traveler")
        return turns


class EditPlanResponse(BaseModel):
    outcome: Literal["updated", "answered", "needs_clarification"]
    # What the message asked for: new Trip details, a day plan change, or just a question.
    change: Literal["request", "itinerary", "question"]
    trip_id: str
    reply: str
    plan: TripPlan | None = None
    reason: RejectionReason | None = None
