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


class RoadRoute(BaseModel):
    """A drive between two places. Hours are a range because hill roads run slower than routing."""

    from_place: str
    to_place: str
    distance_km: int = Field(ge=0)
    hours_low: float = Field(ge=0)
    hours_high: float = Field(ge=0)
    road_ends_km_before: int | None = None
