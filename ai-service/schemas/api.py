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


class Clarification(BaseModel):
    missing_fields: list[str]
    question: str


class PlanTripResponse(BaseModel):
    status: Literal["needs_clarification", "planned"]
    trip_id: str
    clarification: Clarification | None = None
    plan: TripPlan | None = None
