import pytest

from domain.budget import BudgetCaps


# Hotel cap = 50% of Budget / nights. Budget 10,000 over 5 nights -> 1,000 per night.
@pytest.mark.parametrize(
    ("price_per_night", "allowed"),
    [(999, True), (1000, True), (1000.5, False), (1001, False)],
)
def test_hotel_cap_on_and_off_points(price_per_night, allowed):
    caps = BudgetCaps.for_trip(budget=10_000, nights=5, travelers=1)

    assert caps.allows_hotel(price_per_night) is allowed


def test_hotel_cap_that_is_not_a_whole_number():
    caps = BudgetCaps.for_trip(budget=1_000, nights=3, travelers=1)  # 166.67 per night

    assert caps.allows_hotel(166) is True
    assert caps.allows_hotel(167) is False


# Flight cap = 35% of Budget / travellers, plus a 15% grace margin.
# Budget 20,000 for 2 travellers -> 3,500 each -> 4,025 with grace.
@pytest.mark.parametrize(
    ("price_per_traveler", "allowed"),
    [(3500, True), (4025, True), (4025.01, False), (4026, False)],
)
def test_flight_cap_on_and_off_points_include_grace(price_per_traveler, allowed):
    caps = BudgetCaps.for_trip(budget=20_000, nights=3, travelers=2)

    assert caps.allows_flight(price_per_traveler) is allowed


def test_search_limits_are_whole_rupees_rounded_down():
    caps = BudgetCaps.for_trip(budget=1_000, nights=3, travelers=1)

    assert caps.hotel_search_limit == 166
    assert caps.flight_search_limit == 402  # 350 * 1.15 = 402.5


@pytest.mark.parametrize(
    ("budget", "nights", "travelers"),
    [(0, 3, 1), (-1, 3, 1), (10_000, 0, 1), (10_000, 3, 0)],
)
def test_caps_need_positive_budget_nights_and_travelers(budget, nights, travelers):
    with pytest.raises(ValueError):
        BudgetCaps.for_trip(budget=budget, nights=nights, travelers=travelers)
