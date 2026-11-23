from dataclasses import dataclass

from schemas.geo import GeoPoint, distance_km

AMBIGUOUS_KM = 100.0
RIVAL_IMPORTANCE = 0.9
# Bigger kinds of place outrank smaller ones; a namesake village never rivals a town.
KIND_RANK = {"region": 4, "city": 4, "town": 3, "village": 2, "hamlet": 1}


@dataclass(frozen=True)
class PlaceMatch:
    """One answer from a place search, best first. `importance` is the Provider's ranking score."""

    name: str
    point: GeoPoint
    radius_km: float
    importance: float
    kind: str


def pick_place(matches: list[PlaceMatch]) -> PlaceMatch | None:
    """The best match, or None when another far-away place of the same size is about as known.

    Never guessing is what stops "Badrinath" turning into a namesake hundreds of km away.
    Thresholds were checked on real answers for Surat, Badrinath, Kedarnath, Udaipur and Manali.
    """
    if not matches:
        return None
    top = matches[0]
    for other in matches[1:]:
        if (
            distance_km(top.point, other.point) > AMBIGUOUS_KM
            and _rank(other) >= _rank(top)
            and other.importance >= RIVAL_IMPORTANCE * top.importance
        ):
            return None
    return top


def _rank(match: PlaceMatch) -> int:
    return KIND_RANK.get(match.kind, 1)
