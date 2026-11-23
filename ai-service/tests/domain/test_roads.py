import pytest

from domain.roads import Drive, road_end_note, road_route


def test_hours_are_a_range_because_hill_roads_are_slower_than_routing_says():
    route = road_route(Drive(km=294.4, hours=7.3, end_gap_km=0.04), "Rishikesh", "Badrinath")

    assert route.from_place == "Rishikesh"
    assert route.to_place == "Badrinath"
    assert route.distance_km == 294
    assert (route.hours_low, route.hours_high) == (9.0, 12.0)  # 7.3 x 1.2 and x 1.6, to the half hour
    assert route.road_ends_km_before is None


@pytest.mark.parametrize(("gap", "expected"), [(2.0, None), (2.1, 2), (9.744, 10)])
def test_road_that_stops_short_of_the_place(gap, expected):
    route = road_route(Drive(km=243, hours=5.2, end_gap_km=gap), "Rishikesh", "Kedarnath")

    assert route.road_ends_km_before == expected


def test_road_end_note_names_the_place_and_the_gap():
    route = road_route(Drive(km=243, hours=5.2, end_gap_km=9.744), "Rishikesh", "Kedarnath")

    assert road_end_note(route) == (
        "The road ends about 10 km before Kedarnath; the rest is on foot or by other transport."
    )


def test_no_note_when_the_road_reaches_the_place():
    route = road_route(Drive(km=436, hours=5.5, end_gap_km=0), "Surat", "Udaipur")

    assert road_end_note(route) is None
