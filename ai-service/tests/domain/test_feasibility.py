import pytest

from domain.feasibility import estimate_trip_cost, is_within_budget


def test_cost_multiplies_hotel_by_nights_and_adds_travel():
    cost = estimate_trip_cost(
        hotel_price_per_night=1_000, nights=3, travel_total=4_000, party_size=2
    )

    assert cost.hotel_total == 3_000
    assert cost.travel_total == 4_000
    assert cost.total == 7_000


# Total 7,000: on-point is a Budget of exactly 7,000, off-point is 6,999.
@pytest.mark.parametrize(("budget", "feasible"), [(7_001, True), (7_000, True), (6_999, False)])
def test_plan_is_feasible_only_when_total_fits_budget(budget, feasible):
    cost = estimate_trip_cost(
        hotel_price_per_night=1_000, nights=3, travel_total=4_000, party_size=2
    )

    assert is_within_budget(cost, budget) is feasible


def test_missing_travel_adds_nothing_to_cost():
    cost = estimate_trip_cost(
        hotel_price_per_night=1_500, nights=2, travel_total=None, party_size=3
    )

    assert cost.travel_total == 0
    assert cost.total == 3_000


def test_total_counts_rooms_activities_and_daily_spend():
    cost = estimate_trip_cost(
        hotel_price_per_night=2_000,
        nights=2,
        rooms=2,
        travel_total=20_000,
        party_size=4,
        activities_per_traveler=700,
        daily_spend_per_traveler=1_500,
        days=3,
    )

    assert cost.hotel_total == 8_000  # 2,000 x 2 nights x 2 rooms
    assert cost.activities_total == 2_800
    assert cost.daily_spend_total == 18_000  # 1,500 x 3 days x 4 Travelers
    assert cost.stay_and_travel == 28_000
    assert cost.total == 48_800


def test_only_stay_and_travel_decide_feasibility():
    cost = estimate_trip_cost(
        hotel_price_per_night=1_000,
        nights=3,
        travel_total=4_000,
        party_size=2,
        daily_spend_per_traveler=5_000,
        days=3,
    )

    assert cost.total > 7_000
    assert is_within_budget(cost, 7_000) is True


def test_missing_hotel_adds_nothing_to_cost():
    cost = estimate_trip_cost(
        hotel_price_per_night=None, nights=2, travel_total=5_000, party_size=2
    )

    assert cost.total == 5_000
