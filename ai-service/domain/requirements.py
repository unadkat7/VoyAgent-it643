from collections.abc import Mapping

from domain.money import trip_currency
from domain.spend import assumed_budget, min_days

# Rule 1: only the Destination is needed to plan; everything else gets a stated default.
REQUIRED_FIELDS: tuple[str, ...] = ("destination",)
DEFAULT_DURATION_DAYS = 3
DEFAULT_PARTY_SIZE = 2
DEFAULT_TRAVEL_STYLE = "relaxed"
# Order of the fields a plan may have guessed or left out, as shown to the Traveler.
ASSUMABLE_FIELDS: tuple[str, ...] = (
    "origin",
    "duration_days",
    "party_size",
    "travel_style",
    "budget",
)
_POSITIVE_NUMBER_FIELDS = frozenset({"duration_days", "budget", "party_size"})


def find_missing_fields(trip_request: Mapping[str, object]) -> list[str]:
    """Rule 1: a Trip is planned only when every required field is known."""
    return [field for field in REQUIRED_FIELDS if _is_missing(field, trip_request.get(field))]


def fill_defaults(
    trip_request: Mapping[str, object],
) -> tuple[dict[str, object], list[str], str | None]:
    """Defaults for the fields the Traveler left out, assumed fields, and an optional currency Note.

    A missing Origin stays empty: there is no sensible guess for where someone lives.
    """
    filled = dict(trip_request)
    currency, currency_note = trip_currency(
        filled.get("budget_currency"),  # type: ignore[arg-type]
        filled.get("origin_country"),  # type: ignore[arg-type]
    )
    filled["currency"] = currency
    assumed = [f for f in ASSUMABLE_FIELDS if _is_missing(f, trip_request.get(f))]
    nights = trip_request.get("nights")
    if "duration_days" in assumed and isinstance(nights, int) and nights > 0:
        # "2 nights in Goa" is a 3-day Trip: nothing was guessed.
        filled["duration_days"] = nights + 1
        assumed.remove("duration_days")
    elif "duration_days" in assumed:
        filled["duration_days"] = max(
            DEFAULT_DURATION_DAYS,
            min_days(filled.get("destination_area"), filled.get("origin_area")),  # type: ignore[arg-type]
            4 if filled.get("destination_kind") == "multi_country" else 1,
        )
    if "party_size" in assumed:
        filled["party_size"] = DEFAULT_PARTY_SIZE
    if "travel_style" in assumed:
        filled["travel_style"] = DEFAULT_TRAVEL_STYLE
    if "budget" in assumed:
        filled["budget"] = assumed_budget(
            travel_style=filled["travel_style"],
            area=filled.get("destination_area"),
            origin_area=filled.get("origin_area"),
            days=filled["duration_days"],
            party_size=filled["party_size"],
            currency=currency,
        )
    if "origin" in assumed:
        filled["origin"] = None
    return filled, assumed, currency_note


def _is_missing(field: str, value: object) -> bool:
    if value is None:
        return True
    if isinstance(value, str):
        return not value.strip()
    if field in _POSITIVE_NUMBER_FIELDS:
        return not isinstance(value, int | float) or value <= 0
    return False
