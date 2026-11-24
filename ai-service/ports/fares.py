from dataclasses import dataclass
from typing import Protocol

from schemas.travel import TrainFare, TravelFares


class FareError(Exception):
    """Fares could not be estimated (search or LLM failure)."""


@dataclass(frozen=True)
class FareQuery:
    origin: str
    destination: str
    month: str  # e.g. "December 2026"


@dataclass(frozen=True)
class TrainSegment:
    """One train ridden between two stations, as the timetable names it."""

    train_number: str
    train_name: str
    from_station: str
    to_station: str


class FarePort(Protocol):
    def estimate(self, query: FareQuery) -> TravelFares: ...

    def train_fares(self, segments: list[TrainSegment], month: str) -> list[TrainFare]: ...
