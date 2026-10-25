from collections.abc import Mapping

REQUIRED_FIELDS: tuple[str, ...] = (
    "departure",
    "destination",
    "duration_days",
    "budget",
    "travelers",
    "travel_style",
)
_POSITIVE_NUMBER_FIELDS = frozenset({"duration_days", "budget", "travelers"})


def find_missing_fields(trip_request: Mapping[str, object]) -> list[str]:
    """Rule 1: a Trip is planned only when every required field is known."""
    return [field for field in REQUIRED_FIELDS if _is_missing(field, trip_request.get(field))]


def _is_missing(field: str, value: object) -> bool:
    if value is None:
        return True
    if isinstance(value, str):
        return not value.strip()
    if field in _POSITIVE_NUMBER_FIELDS:
        return not isinstance(value, int | float) or value <= 0
    return False
