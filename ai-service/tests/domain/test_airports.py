import pytest

from domain.airports import airport_code


@pytest.mark.parametrize(
    ("place", "code"),
    [
        ("Mumbai", "BOM"),
        ("  mumbai ", "BOM"),
        ("Bengaluru", "BLR"),
        ("Bangalore", "BLR"),
        ("goa", "GOI"),
        ("Dubai", "DXB"),
        ("Istanbul", "IST"),
    ],
)
def test_known_cities_map_to_their_airport(place, code):
    assert airport_code(place) == code


@pytest.mark.parametrize(
    ("place", "code"),
    [("Muscat", "MCT"), ("Doha", "DOH"), ("Tbilisi", "TBS"), ("Bhuntar", "KUU"), ("Kuta", "DPS")],
)
def test_cities_outside_the_hand_list_come_from_the_bundled_airport_data(place, code):
    assert airport_code(place) == code


def test_hand_list_wins_where_bundled_data_has_no_single_answer():
    # "London" and "Paris" also name towns in other countries, so the data leaves them out.
    assert airport_code("London") == "LHR"
    assert airport_code("Paris") == "CDG"


def test_uppercase_iata_code_is_used_as_given():
    assert airport_code("BOM") == "BOM"


@pytest.mark.parametrize("place", ["Manali", "Una", "del", "", None])
def test_unknown_place_has_no_airport_instead_of_a_fallback(place):
    # Rule 4: never silently swap the Destination for another city's airport.
    assert airport_code(place) is None
