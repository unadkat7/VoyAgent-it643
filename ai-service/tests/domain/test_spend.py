import pytest

from domain.spend import BUDGET, LUXURY, STANDARD, daily_spend_per_traveler, rooms_for, style_tier


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
