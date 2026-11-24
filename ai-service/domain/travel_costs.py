from math import ceil

from domain.money import format_money, from_inr
from schemas.recommendations import FlightRecommendation
from schemas.travel import FareRange, TrainFare, TrainOption, TravelFares, TravelOption

SEATS = (("ac3", "3AC"), ("sleeper", "Sleeper"))

# Rough fuel and tolls for one car, per km, in INR.
CAR_RUPEES_PER_KM = 9
TRAVELERS_PER_CAR = 4


def cars_for(party_size: int) -> int:
    return max(1, ceil(party_size / TRAVELERS_PER_CAR))


def car_cost(distance_km: float, party_size: int, currency: str = "INR") -> int:
    """There and back by car: the cost is per car, not per Traveler."""
    return from_inr(distance_km * 2 * CAR_RUPEES_PER_KM * cars_for(party_size), currency)


def travel_options(
    *,
    flights: list[FlightRecommendation],
    fares: TravelFares | None,
    road_km: float | None,
    party_size: int,
    trains_out: list[TrainOption] | None = None,
    trains_back: list[TrainOption] | None = None,
    currency: str = "INR",
) -> list[TravelOption]:
    """Every priced way there and back for the whole Travel Party, cheapest first."""
    options: list[TravelOption] = []
    one_way = [f for f in flights if f.direction]
    if one_way:
        if {f.direction for f in one_way} == {"outbound", "return"}:
            fare = round(sum(f.price_per_traveler for f in one_way))
            options.append(
                TravelOption(
                    mode="flight",
                    label="Flights",
                    detail="Outbound and return fares",
                    per_person_low=fare,
                    per_person_high=fare,
                    total=fare * party_size,
                    source="estimated"
                    if any(f.price_source == "estimated" for f in one_way)
                    else "live",
                    over_budget=any(f.over_budget for f in one_way),
                )
            )
    elif flights:
        flight = min(flights, key=lambda f: f.price_per_traveler)
        fare = round(flight.price_per_traveler)
        options.append(
            TravelOption(
                mode="flight",
                label=f"Flight · {flight.airline}",
                detail="Cheapest round-trip fare found",
                per_person_low=fare,
                per_person_high=fare,
                total=fare * party_size,
                source=flight.price_source,
                over_budget=flight.over_budget,
            )
        )
    # Fares for the exact trains there and back beat a route-wide estimate.
    by_train = _train_option(trains_out or [], trains_back or [], party_size)
    if by_train:
        options.append(by_train)
    if fares:
        train = fares.train_ac3 or fares.train_sleeper
        if train and not by_train:
            seat = "3AC" if fares.train_ac3 else "Sleeper"
            other = fares.train_sleeper if fares.train_ac3 else None
            detail = f"Sleeper from {format_money(other.low, currency)} one way" if other else None
            options.append(_fare_option("train", f"Train · {seat}", train, party_size, detail))
        if fares.bus:
            options.append(_fare_option("bus", "Bus", fares.bus, party_size, None))
    if road_km:
        total = car_cost(road_km, party_size, currency=currency)
        cars = cars_for(party_size)
        options.append(
            TravelOption(
                mode="car",
                label="By car",
                detail=f"{round(road_km):,} km each way · fuel and tolls for {cars} "
                f"{'car' if cars == 1 else 'cars'}",
                per_person_low=round(total / party_size),
                per_person_high=round(total / party_size),
                total=total,
            )
        )
    return sorted(options, key=lambda option: option.total)


def _fare_option(
    mode: str, label: str, one_way: FareRange, party_size: int, detail: str | None
) -> TravelOption:
    low, high = one_way.low * 2, one_way.high * 2
    return TravelOption(
        mode=mode,
        label=label,
        detail=detail,
        per_person_low=low,
        per_person_high=high,
        total=round((low + high) / 2 * party_size),
    )


def price_trains(options: list[TrainOption], fares: list[TrainFare]) -> list[TrainOption]:
    """A seat class is priced only when every train in the option has a fare for it."""
    by_number = {fare.train_number: fare for fare in fares}
    priced = []
    for option in options:
        update = {}
        for seat, _ in SEATS:
            ranges = [getattr(by_number.get(leg.train_number), seat, None) for leg in option.legs]
            if ranges and all(ranges):
                update[seat] = FareRange(
                    low=sum(r.low for r in ranges), high=sum(r.high for r in ranges)
                )
        priced.append(option.model_copy(update=update))
    return priced


def _train_option(
    out: list[TrainOption], back: list[TrainOption], party_size: int
) -> TravelOption | None:
    for seat, label in SEATS:
        going = [o for o in out if getattr(o, seat)]
        coming = [o for o in back if getattr(o, seat)]
        if not going or not coming:
            continue
        there = min(going, key=lambda o: getattr(o, seat).low)
        home = min(coming, key=lambda o: getattr(o, seat).low)
        low = getattr(there, seat).low + getattr(home, seat).low
        high = getattr(there, seat).high + getattr(home, seat).high
        return TravelOption(
            mode="train",
            label=f"Train · {label}",
            detail=f"{_trains(there)} there, {_trains(home)} back",
            per_person_low=low,
            per_person_high=high,
            total=round((low + high) / 2 * party_size),
        )
    return None


def _trains(option: TrainOption) -> str:
    return " + ".join(f"{leg.train_number} {leg.train_name}" for leg in option.legs)


def chosen_option(options: list[TravelOption], mode: str | None) -> TravelOption | None:
    """The option the Traveler picked, else the cheapest."""
    picked = next((option for option in options if option.mode == mode), None)
    return picked or (options[0] if options else None)
