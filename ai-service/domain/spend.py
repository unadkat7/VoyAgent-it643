from math import ceil

from domain.money import from_inr
from schemas.trip_request import WorldArea

# Rough planning floors in INR from India, not quoted prices.
MIN_PER_TRAVELER_PER_DAY = {
    "india": 2500,
    "south_asia": 3000,
    "southeast_asia": 4000,
    "east_asia": 8000,
    "middle_east": 7000,
    "europe": 9000,
    "africa": 6000,
    "americas": 10000,
    "oceania": 10000,
}
MIN_RETURN_FLIGHT_PER_TRAVELER = {
    "india": 0,
    "south_asia": 15000,
    "southeast_asia": 25000,
    "east_asia": 40000,
    "middle_east": 25000,
    "europe": 60000,
    "africa": 55000,
    "americas": 90000,
    "oceania": 80000,
}
MIN_DAYS = {
    "india": 1,
    "south_asia": 3,
    "southeast_asia": 3,
    "east_asia": 4,
    "middle_east": 3,
    "europe": 5,
    "africa": 5,
    "americas": 6,
    "oceania": 6,
}

NEIGHBOURS: dict[str, frozenset[str]] = {
    "india": frozenset({"south_asia", "southeast_asia", "middle_east"}),
    "south_asia": frozenset({"india", "southeast_asia", "middle_east"}),
    "southeast_asia": frozenset({"india", "south_asia", "east_asia", "oceania"}),
    "east_asia": frozenset({"southeast_asia"}),
    "middle_east": frozenset({"india", "south_asia", "europe", "africa"}),
    "europe": frozenset({"middle_east", "africa"}),
    "africa": frozenset({"middle_east", "europe"}),
    "oceania": frozenset({"southeast_asia"}),
}


def _flight_floor_inr(area: WorldArea | None, origin_area: WorldArea | None = None) -> int:
    if area is None:
        return 0
    if origin_area in (None, "india"):
        return MIN_RETURN_FLIGHT_PER_TRAVELER.get(area, 0)
    if origin_area == area:
        return 0
    if area in NEIGHBOURS.get(origin_area, frozenset()):
        return 15_000
    return 60_000


def min_days(area: WorldArea | None, origin_area: WorldArea | None = None) -> int:
    if area is None:
        return 1
    if origin_area in (None, "india"):
        return MIN_DAYS.get(area, 1)
    if origin_area == area:
        return 1
    if area in NEIGHBOURS.get(origin_area, frozenset()):
        return 3
    return 5


def minimum_trip_cost(
    area: WorldArea | None,
    days: int,
    party_size: int,
    origin_area: WorldArea | None = None,
    currency: str = "INR",
) -> int:
    inr = (
        MIN_PER_TRAVELER_PER_DAY.get(area, 0) * days + _flight_floor_inr(area, origin_area)
    ) * party_size
    return from_inr(inr, currency)


BUDGET, STANDARD, LUXURY = "budget", "standard", "luxury"

_BUDGET_WORDS = ("budget", "backpack", "cheap", "economy", "shoestring")
_LUXURY_WORDS = ("luxury", "premium", "lavish", "five star", "5 star")

# Rough food and local travel per Traveler per day, in INR.
DAILY_SPEND_PER_TRAVELER = {BUDGET: 800, STANDARD: 1_500, LUXURY: 3_000}
# Used only when the Traveler gave no Budget: a whole-trip spend per Traveler per day.
ASSUMED_BUDGET_PER_TRAVELER_PER_DAY = {BUDGET: 3_000, STANDARD: 6_000, LUXURY: 15_000}

TRAVELERS_PER_ROOM = 2


def style_tier(travel_style: str | None) -> str:
    text = (travel_style or "").lower()
    if any(word in text for word in _LUXURY_WORDS):
        return LUXURY
    if any(word in text for word in _BUDGET_WORDS):
        return BUDGET
    return STANDARD


def rooms_for(party_size: int) -> int:
    return max(1, ceil(party_size / TRAVELERS_PER_ROOM))


def daily_spend_per_traveler(travel_style: str | None, currency: str = "INR") -> int:
    return from_inr(DAILY_SPEND_PER_TRAVELER[style_tier(travel_style)], currency)


def assumed_budget(
    *,
    travel_style: str | None,
    days: int,
    party_size: int,
    area: WorldArea | None = None,
    origin_area: WorldArea | None = None,
    currency: str = "INR",
) -> int:
    style_budget = from_inr(
        ASSUMED_BUDGET_PER_TRAVELER_PER_DAY[style_tier(travel_style)] * days * party_size,
        currency,
    )
    return max(
        style_budget,
        minimum_trip_cost(area, days, party_size, origin_area=origin_area, currency=currency),
    )
