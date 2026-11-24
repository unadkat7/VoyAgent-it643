from dataclasses import dataclass
from typing import Protocol

from schemas.travel import TravelFares


class FareError(Exception):
    """Fares could not be estimated (search or LLM failure)."""


@dataclass(frozen=True)
class FareQuery:
    origin: str
    destination: str
    month: str  # e.g. "December 2026"


class FarePort(Protocol):
    def estimate(self, query: FareQuery) -> TravelFares: ...
