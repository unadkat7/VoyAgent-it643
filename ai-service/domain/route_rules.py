from domain.place_rules import PlaceProblem
from domain.spend import MIN_DAYS, MIN_RETURN_FLIGHT_PER_TRAVELER, minimum_trip_cost
from schemas.itinerary import ItineraryDay
from schemas.route import RouteStop
from schemas.trip_request import TripRequest

MIN_DAYS_PER_STOP = 2


def destination_bases(stops: list[RouteStop], request: TripRequest) -> list[RouteStop]:
    origin = (request.origin or "").strip().casefold()
    destination = request.destination.casefold()
    includes_india = request.destination_area in ("india", "south_asia") or "india" in destination
    return [
        s
        for s in stops
        if s.city.strip().casefold() != origin
        and (includes_india or (s.country or "").strip().casefold() != "india")
    ]


def fit_stops(stops: list[RouteStop], duration_days: int) -> tuple[list[RouteStop], list[str]]:
    count = max(1, duration_days // MIN_DAYS_PER_STOP)
    kept, dropped = stops[:count], stops[count:]
    if not kept:
        return [], []
    notes = []
    if dropped:
        names = ", ".join(s.city for s in dropped)
        cities = "city" if count == 1 else "cities"
        notes.append(
            f"{duration_days} days fits {count} {cities}, so I left out {names}. "
            "Add days to include it."
        )
    # Reserve each city's minimum, then distribute spare days by largest remainder.
    base = min(MIN_DAYS_PER_STOP, duration_days // len(kept))
    spare = duration_days - base * len(kept)
    weights = [max(0, s.days - base) for s in kept]
    if not any(weights):
        weights = [1] * len(kept)
    shares = [divmod(w * spare, sum(weights)) for w in weights]
    days = [base + q for q, _ in shares]
    for i in sorted(range(len(kept)), key=lambda i: -shares[i][1])[: duration_days - sum(days)]:
        days[i] += 1
    return [s.model_copy(update={"days": d}) for s, d in zip(kept, days, strict=True)], notes


def route_label(route: list[RouteStop]) -> str:
    first = 1
    ranges = []
    for stop in route:
        last = first + stop.days - 1
        ranges.append(f"Days {first}-{last} {stop.city}")
        first = last + 1
    return "; ".join(ranges)


def feasibility_problem(request: TripRequest, assumed_fields=()) -> PlaceProblem | None:
    area, days, party = request.destination_area, request.duration_days, request.party_size
    floor = minimum_trip_cost(area, days, party)
    needed = MIN_DAYS.get(area, 1)
    if "budget" not in assumed_fields and request.budget < floor:
        flight = MIN_RETURN_FLIGHT_PER_TRAVELER[area] * party
        airfare = f" Return flights from India alone are about ₹{flight:,}." if flight else ""
        duration = f" Allow at least {needed} days including flights." if days < needed else ""
        return PlaceProblem(
            "budget",
            f"₹{request.budget:,} for {party} people for {days} days in "
            f"{request.destination} won't work.{airfare} You'd need about ₹{floor:,} "
            f"for those dates.{duration} Want to raise the budget or pick another place?",
        )
    if days < needed:
        return PlaceProblem(
            "duration_days",
            f"{request.destination} needs at least {needed} days "
            "including flights. How many days can you do?",
        )
    return None


def tag_days(days: list[ItineraryDay], route: list[RouteStop]) -> list[ItineraryDay]:
    indices = [i for i, stop in enumerate(route) for _ in range(stop.days)]
    return [
        day.model_copy(update={"stop": indices[day.day - 1]})
        for day in days
        if day.day <= len(indices)
    ]
