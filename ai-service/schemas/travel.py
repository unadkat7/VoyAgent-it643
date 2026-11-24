from typing import Literal

from pydantic import BaseModel, Field


class TrainLeg(BaseModel):
    """One train ridden between two Stations. Times are local, ISO 8601 without a zone."""

    train_number: str
    train_name: str
    from_code: str
    from_station: str
    to_code: str
    to_station: str
    departs: str
    arrives: str


class TrainOption(BaseModel):
    """A way to get there by train, straight from the timetable: never written by the LLM."""

    legs: list[TrainLeg]
    departs: str
    arrives: str
    duration_minutes: int = Field(ge=0)
    change_at: str | None = None
    wait_minutes: int | None = None
    runs_on: list[str] = Field(default_factory=list)


class FareRange(BaseModel):
    """A one-way fare for one Traveler in INR, as a range because fares vary by date and seat."""

    low: int = Field(ge=0)
    high: int = Field(ge=0)


class TravelFares(BaseModel):
    """Approximate fares read from web search results. Never a confirmed price."""

    train_sleeper: FareRange | None = None
    train_ac3: FareRange | None = None
    bus: FareRange | None = None


TravelMode = Literal["flight", "train", "bus", "car"]


class TravelOption(BaseModel):
    """One way to get there and back, priced for the whole Travel Party, round trip."""

    mode: TravelMode
    label: str
    detail: str | None = None
    per_person_low: int = Field(ge=0)
    per_person_high: int = Field(ge=0)
    total: int = Field(ge=0)
    source: Literal["live", "estimated"] = "estimated"
    over_budget: bool = False


class RoadRoute(BaseModel):
    """A drive between two places. Hours are a range because hill roads run slower than routing."""

    from_place: str
    to_place: str
    distance_km: int = Field(ge=0)
    hours_low: float = Field(ge=0)
    hours_high: float = Field(ge=0)
    road_ends_km_before: int | None = None
