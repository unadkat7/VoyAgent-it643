import pytest

from domain.money import from_inr
from domain.spend import (
    BUDGET,
    LUXURY,
    MIN_DAYS,
    STANDARD,
    daily_spend_per_traveler,
    min_days,
    minimum_trip_cost,
    rooms_for,
    style_tier,
)


@pytest.mark.parametrize(
    ("style", "tier"),
    [
        ("budget", BUDGET),
        ("Backpacking", BUDGET),
        ("luxury", LUXURY),
        ("premium beach", LUXURY),
        ("relaxed beach", STANDARD),
        (None, STANDARD),
    ],
)
def test_style_tier(style, tier):
    assert style_tier(style) == tier


# Two Travelers share a room.
@pytest.mark.parametrize(("party", "rooms"), [(1, 1), (2, 1), (3, 2), (4, 2), (5, 3)])
def test_rooms_for_party(party, rooms):
    assert rooms_for(party) == rooms


def test_daily_spend_grows_with_style():
    assert daily_spend_per_traveler("budget") < daily_spend_per_traveler("relaxed")
    assert daily_spend_per_traveler("relaxed") < daily_spend_per_traveler("luxury")


def test_minimum_trip_cost_scales_for_same_area_and_currency():
    expected = from_inr(10_000 * 2, "USD")
    assert (
        minimum_trip_cost(
            area="americas",
            days=2,
            party_size=1,
            origin_area="americas",
            currency="USD",
        )
        == expected
    )


def test_min_days_depends_on_origin_and_destination_areas():
    assert min_days("americas", origin_area="americas") == 1
    assert min_days("europe", origin_area="middle_east") == 3
    assert min_days("europe", origin_area="americas") == 5
    assert min_days("americas", origin_area=None) == MIN_DAYS["americas"]
    assert minimum_trip_cost(area="americas", days=6, party_size=1, origin_area=None) == (
        90_000 + 10_000 * 6
    )
