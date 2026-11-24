import pytest

from domain.requirements import REQUIRED_FIELDS, fill_defaults, find_missing_fields

COMPLETE = {
    "origin": "Ahmedabad",
    "destination": "Goa",
    "duration_days": 4,
    "budget": 40000,
    "party_size": 2,
    "travel_style": "relaxed",
}


def test_only_the_destination_is_required():
    assert REQUIRED_FIELDS == ("destination",)
    assert find_missing_fields({"destination": "Ooty"}) == []


def test_empty_trip_request_misses_the_destination():
    assert find_missing_fields({}) == ["destination"]


@pytest.mark.parametrize("blank", [None, "", "   "])
def test_blank_destination_counts_as_missing(blank):
    assert find_missing_fields({**COMPLETE, "destination": blank}) == ["destination"]


def test_complete_request_needs_no_defaults():
    filled, assumed, note = fill_defaults(COMPLETE)

    assert filled == {**COMPLETE, "currency": "INR"}
    assert assumed == []
    assert note is None


def test_bare_destination_gets_stated_defaults_and_a_budget_to_match():
    filled, assumed, _ = fill_defaults({"origin": "Mumbai", "destination": "Ooty"})

    assert assumed == ["duration_days", "party_size", "travel_style", "budget"]
    assert filled["duration_days"] == 3
    assert filled["party_size"] == 2
    assert filled["travel_style"] == "relaxed"
    assert filled["budget"] == 6_000 * 3 * 2  # standard style, per Traveler per day


def test_missing_origin_is_flagged_but_never_guessed():
    filled, assumed, _ = fill_defaults({**COMPLETE, "origin": "  "})

    assert assumed == ["origin"]
    assert filled["origin"] is None


@pytest.mark.parametrize(
    ("field", "value"),
    [("duration_days", 0), ("budget", 0), ("budget", -500), ("party_size", 0)],
)
def test_non_positive_numbers_are_replaced_by_defaults(field, value):
    filled, assumed, _ = fill_defaults({**COMPLETE, field: value})

    assert assumed == [field]
    assert filled[field] > 0


def test_stated_nights_set_the_days_without_guessing():
    filled, assumed, _ = fill_defaults({**COMPLETE, "duration_days": None, "nights": 2})

    assert filled["duration_days"] == 3
    assert "duration_days" not in assumed


def test_guessed_budget_follows_a_luxury_style():
    filled, _, _ = fill_defaults({**COMPLETE, "budget": None, "travel_style": "luxury"})

    assert filled["budget"] == 15_000 * 4 * 2
