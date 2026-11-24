from math import ceil

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


def daily_spend_per_traveler(travel_style: str | None) -> int:
    return DAILY_SPEND_PER_TRAVELER[style_tier(travel_style)]


def assumed_budget(*, travel_style: str | None, days: int, party_size: int) -> int:
    return ASSUMED_BUDGET_PER_TRAVELER_PER_DAY[style_tier(travel_style)] * days * party_size
