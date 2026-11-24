from dataclasses import dataclass

from schemas.api import RejectionReason
from schemas.trip_request import TripRequest

MAX_DURATION_DAYS = 30
MAX_PARTY_SIZE = 20
MAX_NIGHTS = 30

# Bare astronomical names also match settlements. A qualified town name can still be geocoded.
CELESTIAL_NAMES = {
    "sun",
    "moon",
    "mercury",
    "venus",
    "mars",
    "jupiter",
    "saturn",
    "uranus",
    "neptune",
    "pluto",
}


@dataclass(frozen=True)
class PlaceProblem:
    field: str
    question: str
    reason: RejectionReason | None = None


def kind_problem(field, name, kind, area) -> PlaceProblem | None:
    if kind == "not_on_earth" or name.strip().casefold().removeprefix("the ") in CELESTIAL_NAMES:
        return PlaceProblem(
            field,
            f"I can only plan trips to real places on Earth. '{name}' isn't one. "
            "Which city, region or country would you like?",
            "not_on_earth",
        )
    if kind == "not_a_place":
        return PlaceProblem(
            field,
            f"I couldn't tell which place '{name}' is. "
            "Which city, region or country would you like?",
            kind,
        )
    if area == "polar":
        return PlaceProblem(
            field,
            f"{name} is only reachable on expedition cruises, which I can't plan. "
            "Want to pick somewhere else?",
            "unreachable",
        )
    if kind == "multi_country" and field == "origin":
        return PlaceProblem(
            field, f"{name} covers several countries. Which country or city should I plan?"
        )
    return None


def number_problem(request: TripRequest) -> PlaceProblem | None:
    for field, limit, unit in (
        ("duration_days", MAX_DURATION_DAYS, "days"),
        ("party_size", MAX_PARTY_SIZE, "people"),
        ("nights", MAX_NIGHTS, "nights"),
    ):
        if (getattr(request, field) or 0) > limit:
            return PlaceProblem(
                field, f"I can plan trips up to {limit} {unit}. How many {unit} should I plan for?"
            )
    return None
