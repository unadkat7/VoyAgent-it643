import pytest

from domain.place_rules import kind_problem, number_problem
from schemas.trip_request import TripRequest


@pytest.mark.parametrize(
    ("kind", "area", "reason"),
    [
        ("not_a_place", None, "not_a_place"),
        ("not_on_earth", None, "not_on_earth"),
        ("region", "polar", "unreachable"),
    ],
)
def test_invalid_place_explains_why(kind, area, reason):
    problem = kind_problem("destination", "Example", kind, area)

    assert problem.reason == reason
    assert "Example" in problem.question


@pytest.mark.parametrize("kind", [None, "city", "region", "country"])
def test_ordinary_places_pass_classification(kind):
    assert kind_problem("destination", "Goa", kind, "india") is None


@pytest.mark.parametrize(
    ("field", "limit"), [("duration_days", 30), ("nights", 30), ("party_size", 20)]
)
def test_numeric_limits_are_inclusive(field, limit):
    assert number_problem(TripRequest(**{field: limit})) is None

    problem = number_problem(TripRequest(**{field: limit + 1}))
    assert problem.field == field
    assert problem.reason is None


@pytest.mark.parametrize("kind", [None, "city"])
def test_bare_planet_names_need_an_earth_destination_even_when_a_map_has_a_namesake(kind):
    problem = kind_problem("destination", "Mars", kind, None)

    assert problem.reason == "not_on_earth"
    assert kind_problem("destination", "Mars, Pennsylvania", "city", "americas") is None
