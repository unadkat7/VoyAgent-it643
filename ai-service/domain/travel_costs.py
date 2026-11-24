from math import ceil

from schemas.recommendations import FlightRecommendation
from schemas.travel import FareRange, TravelFares, TravelOption

# Rough fuel and tolls for one car, per km, in INR.
CAR_RUPEES_PER_KM = 9
TRAVELERS_PER_CAR = 4


def cars_for(party_size: int) -> int:
    return max(1, ceil(party_size / TRAVELERS_PER_CAR))


def car_cost(distance_km: float, party_size: int) -> int:
    """There and back by car: the cost is per car, not per Traveler."""
    return round(distance_km * 2 * CAR_RUPEES_PER_KM * cars_for(party_size))


def travel_options(
    *,
    flights: list[FlightRecommendation],
    fares: TravelFares | None,
    road_km: float | None,
    party_size: int,
) -> list[TravelOption]:
    """Every priced way there and back for the whole Travel Party, cheapest first."""
    options: list[TravelOption] = []
    if flights:
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
    if fares:
        train = fares.train_ac3 or fares.train_sleeper
        if train:
            seat = "3AC" if fares.train_ac3 else "Sleeper"
            other = fares.train_sleeper if fares.train_ac3 else None
            detail = f"Sleeper from ₹{other.low:,} one way" if other else None
            options.append(_fare_option("train", f"Train · {seat}", train, party_size, detail))
        if fares.bus:
            options.append(_fare_option("bus", "Bus", fares.bus, party_size, None))
    if road_km:
        total = car_cost(road_km, party_size)
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


def chosen_option(options: list[TravelOption], mode: str | None) -> TravelOption | None:
    """The option the Traveler picked, else the cheapest."""
    picked = next((option for option in options if option.mode == mode), None)
    return picked or (options[0] if options else None)
