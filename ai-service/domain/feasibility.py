from dataclasses import dataclass
from fractions import Fraction


@dataclass(frozen=True)
class TripCost:
    hotel_total: Fraction
    flight_total: Fraction

    @property
    def total(self) -> Fraction:
        return self.hotel_total + self.flight_total


def estimate_trip_cost(
    *,
    hotel_price_per_night: float | None,
    nights: int,
    flight_price_per_traveler: float | None,
    party_size: int,
) -> TripCost:
    """A missing Hotel or Flight adds nothing; the plan notes say why it is missing."""
    hotel = Fraction(hotel_price_per_night or 0) * nights
    flight = Fraction(flight_price_per_traveler or 0) * party_size
    return TripCost(hotel_total=hotel, flight_total=flight)


def is_within_budget(cost: TripCost, budget: int) -> bool:
    """Rule 3: a plan is feasible only if its Estimated Cost fits the Budget."""
    return cost.total <= budget
