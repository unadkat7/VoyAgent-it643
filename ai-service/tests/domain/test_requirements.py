import pytest

from domain.requirements import REQUIRED_FIELDS, find_missing_fields

COMPLETE = {
    "origin": "Ahmedabad",
    "destination": "Goa",
    "duration_days": 4,
    "budget": 40000,
    "party_size": 2,
    "travel_style": "relaxed",
}


def test_complete_trip_request_has_no_missing_fields():
    assert find_missing_fields(COMPLETE) == []


def test_empty_trip_request_misses_every_required_field_in_order():
    assert find_missing_fields({}) == list(REQUIRED_FIELDS)


@pytest.mark.parametrize("field", REQUIRED_FIELDS)
def test_each_required_field_is_reported_when_absent(field):
    request = {k: v for k, v in COMPLETE.items() if k != field}

    assert find_missing_fields(request) == [field]


@pytest.mark.parametrize("blank", [None, "", "   "])
def test_blank_text_counts_as_missing(blank):
    assert find_missing_fields({**COMPLETE, "destination": blank}) == ["destination"]


@pytest.mark.parametrize(
    ("field", "value"),
    [("duration_days", 0), ("budget", 0), ("budget", -500), ("party_size", 0)],
)
def test_non_positive_numbers_count_as_missing(field, value):
    assert find_missing_fields({**COMPLETE, field: value}) == [field]


def test_smallest_valid_numbers_are_accepted():
    request = {**COMPLETE, "duration_days": 1, "budget": 1, "party_size": 1}

    assert find_missing_fields(request) == []


def test_optional_fields_never_block_planning():
    assert find_missing_fields({**COMPLETE, "interests": [], "start_date": None}) == []
