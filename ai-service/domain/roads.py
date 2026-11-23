from dataclasses import dataclass

from schemas.travel import RoadRoute

# Free routing assumes open roads; hill roads were 25-60% slower on the routes checked.
SLOW_FACTOR_LOW = 1.2
SLOW_FACTOR_HIGH = 1.6
ROAD_END_KM = 2.0


@dataclass(frozen=True)
class Drive:
    """A car route as the routing Provider sees it. `end_gap_km`: how far the road stops short."""

    km: float
    hours: float
    end_gap_km: float = 0.0


def _half_hours(hours: float) -> float:
    return round(hours * 2) / 2


def road_route(drive: Drive, from_place: str, to_place: str) -> RoadRoute:
    gap = round(drive.end_gap_km) if drive.end_gap_km > ROAD_END_KM else None
    return RoadRoute(
        from_place=from_place,
        to_place=to_place,
        distance_km=round(drive.km),
        hours_low=_half_hours(drive.hours * SLOW_FACTOR_LOW),
        hours_high=_half_hours(drive.hours * SLOW_FACTOR_HIGH),
        road_ends_km_before=gap,
    )


def road_end_note(route: RoadRoute) -> str | None:
    if route.road_ends_km_before is None:
        return None
    return (
        f"The road ends about {route.road_ends_km_before} km before {route.to_place}; "
        "the rest is on foot or by other transport."
    )
