import pytest

from domain.feasibility import estimate_trip_cost, is_within_budget


def test_cost_multiplies_hotel_by_nights_and_flight_by_party_size():
    cost = estimate_trip_cost(
        hotel_price_per_night=1_000, nights=3, flight_price_per_traveler=2_000, party_size=2
    )

    assert cost.hotel_total == 3_000
    assert cost.flight_total == 4_000
    assert cost.total == 7_000


# Total 7,000: on-point is a Budget of exactly 7,000, off-point is 6,999.
@pytest.mark.parametrize(("budget", "feasible"), [(7_001, True), (7_000, True), (6_999, False)])
def test_plan_is_feasible_only_when_total_fits_budget(budget, feasible):
    cost = estimate_trip_cost(
        hotel_price_per_night=1_000, nights=3, flight_price_per_traveler=2_000, party_size=2
    )

    assert is_within_budget(cost, budget) is feasible


def test_missing_flight_adds_nothing_to_cost():
    cost = estimate_trip_cost(
        hotel_price_per_night=1_500, nights=2, flight_price_per_traveler=None, party_size=3
    )

    assert cost.flight_total == 0
    assert cost.total == 3_000


def test_missing_hotel_adds_nothing_to_cost():
    cost = estimate_trip_cost(
        hotel_price_per_night=None, nights=2, flight_price_per_traveler=2_500, party_size=2
    )

    assert cost.total == 5_000
