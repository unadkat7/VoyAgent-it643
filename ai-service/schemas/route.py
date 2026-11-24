from typing import Literal

from pydantic import AliasChoices, BaseModel, Field


class RouteStop(BaseModel):
    city: str = Field(min_length=1)
    country: str | None = None
    days: int = Field(ge=1)
    airport_code: str | None = None


class StopLeg(BaseModel):
    from_city: str
    to_city: str
    mode: Literal["flight", "train", "bus", "ferry"]
    est_per_person: int = Field(
        ge=0, validation_alias=AliasChoices("est_per_person", "est_inr_per_person")
    )


class RoutePlan(BaseModel):
    stops: list[RouteStop] = Field(default_factory=list)
    legs: list[StopLeg] = Field(default_factory=list)
