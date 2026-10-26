from dataclasses import dataclass
from fractions import Fraction
from math import floor

HOTEL_SHARE = Fraction(50, 100)
FLIGHT_SHARE = Fraction(35, 100)
FLIGHT_GRACE = Fraction(15, 100)


@dataclass(frozen=True)
class BudgetCaps:
    """Rule 2: how much of the Budget one Hotel night and one Flight ticket may use."""

    hotel_per_night: Fraction
    flight_per_traveler: Fraction

    @classmethod
    def for_trip(cls, *, budget: int, nights: int, party_size: int) -> "BudgetCaps":
        if budget <= 0 or nights <= 0 or party_size <= 0:
            raise ValueError("budget, nights and party_size must all be positive")
        return cls(
            hotel_per_night=Fraction(budget) * HOTEL_SHARE / nights,
            flight_per_traveler=Fraction(budget) * FLIGHT_SHARE / party_size,
        )

    @property
    def _flight_limit(self) -> Fraction:
        return self.flight_per_traveler * (1 + FLIGHT_GRACE)

    # Fractions keep 3500 * 1.15 exactly 4025; floats would reject a 4025 fare.
    def allows_hotel(self, price_per_night: float) -> bool:
        return Fraction(price_per_night) <= self.hotel_per_night

    def allows_flight(self, price_per_traveler: float) -> bool:
        return Fraction(price_per_traveler) <= self._flight_limit

    @property
    def hotel_search_limit(self) -> int:
        return floor(self.hotel_per_night)

    @property
    def flight_search_limit(self) -> int:
        return floor(self._flight_limit)
