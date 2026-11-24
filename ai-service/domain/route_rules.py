import re
from itertools import pairwise

from domain.money import format_money, from_inr
from domain.place_rules import PlaceProblem
from domain.spend import _flight_floor_inr, min_days, minimum_trip_cost
from schemas.itinerary import ItineraryDay
from schemas.route import RouteStop, StopLeg
from schemas.trip_request import TripRequest

MIN_DAYS_PER_STOP = 2


def _city_key(name: str) -> str:
    # "Brussels (Bruxelles)" and "Brussels, Belgium" are both Brussels.
    return re.sub(r"\(.*?\)", "", name).split(",")[0].strip().casefold()


def connect_stops(stops: list[RouteStop], legs: list[StopLeg]) -> tuple[list[StopLeg], list[str]]:
    """Legs between consecutive stops. An unpriced leg becomes a note, not a refusal."""
    priced = {(_city_key(leg.from_city), _city_key(leg.to_city)): leg for leg in legs}
    connected, notes = [], []
    for a, b in pairwise(stops):
        leg = priced.get((_city_key(a.city), _city_key(b.city)))
        if leg is None:
            notes.append(
                f"I couldn't estimate travel from {a.city} to {b.city}, so it isn't in the "
                "total. Check trains or flights between them."
            )
            continue
        connected.append(leg.model_copy(update={"from_city": a.city, "to_city": b.city}))
    return connected, notes


def destination_bases(stops: list[RouteStop], request: TripRequest) -> list[RouteStop]:
    origin = (request.origin or "").strip().casefold()
    origin_area = request.origin_area or "india"
    home_country = (request.origin_country or "IN").strip().casefold()
    home_names = {home_country} | ({"india"} if home_country == "in" else set())
    drop_home = (
        request.destination_area is not None
        and request.destination_area != origin_area
        and not (home_country == "in" and request.destination_area == "south_asia")
    )
    return [
        s
        for s in stops
        if s.city.strip().casefold() != origin
        and (not drop_home or (s.country or "").strip().casefold() not in home_names)
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
    cur = request.currency
    floor = minimum_trip_cost(area, days, party, origin_area=request.origin_area, currency=cur)
    needed = min_days(area, origin_area=request.origin_area)
    if "budget" not in assumed_fields and request.budget < floor:
        flight = from_inr(_flight_floor_inr(area, request.origin_area) * party, cur)
        if flight:
            where = f"from {request.origin}" if request.origin else "alone"
            airfare = f" Return flights {where} are about {format_money(flight, cur)}."
        else:
            airfare = ""
        duration = f" Allow at least {needed} days including flights." if days < needed else ""
        party_text = "1 person" if party == 1 else f"{party} people"
        return PlaceProblem(
            "budget",
            f"{format_money(request.budget, cur)} for {party_text} for {days} days in "
            f"{request.destination} won't work.{airfare} You'd need about "
            f"{format_money(floor, cur)} for those dates.{duration} "
            "Want to raise the budget or pick another place?",
            suggestion=floor,
        )
    if days < needed:
        return PlaceProblem(
            "duration_days",
            f"{request.destination} needs at least {needed} days "
            "including flights. How many days can you do?",
            suggestion=needed,
        )
    return None


def tag_days(days: list[ItineraryDay], route: list[RouteStop]) -> list[ItineraryDay]:
    indices = [i for i, stop in enumerate(route) for _ in range(stop.days)]
    return [
        day.model_copy(update={"stop": indices[day.day - 1]})
        for day in days
        if day.day <= len(indices)
    ]
