from dataclasses import dataclass
from fractions import Fraction

from domain.spend import minimum_trip_cost as minimum_trip_cost


@dataclass(frozen=True)
class TripCost:
    hotel_total: Fraction
    travel_total: Fraction
    activities_total: Fraction = Fraction(0)
    daily_spend_total: Fraction = Fraction(0)
    currency: str = "INR"

    @property
    def stay_and_travel(self) -> Fraction:
        return self.hotel_total + self.travel_total

    @property
    def total(self) -> Fraction:
        return self.stay_and_travel + self.activities_total + self.daily_spend_total


def estimate_trip_cost(
    *,
    hotel_price_per_night: float | None = None,
    stays: list[tuple[float, int]] | None = None,
    nights: int,
    travel_total: float | None,
    party_size: int,
    rooms: int = 1,
    activities_per_traveler: float = 0,
    daily_spend_per_traveler: float = 0,
    days: int = 0,
    currency: str = "INR",
) -> TripCost:
    """A missing Hotel or travel option adds nothing; the plan notes say why it is missing."""
    return TripCost(
        hotel_total=sum((Fraction(price) * count * rooms for price, count in stays), Fraction(0))
        if stays is not None
        else Fraction(hotel_price_per_night or 0) * nights * rooms,
        travel_total=Fraction(travel_total or 0),
        activities_total=Fraction(activities_per_traveler) * party_size,
        daily_spend_total=Fraction(daily_spend_per_traveler) * days * party_size,
        currency=currency,
    )


def is_within_budget(cost: TripCost, budget: int) -> bool:
    """Rule 3: a plan is feasible only if its stay and travel fit the Budget.

    Food and Activities are shown in the total but never block a plan: they are rough guesses.
    """
    return cost.stay_and_travel <= budget
