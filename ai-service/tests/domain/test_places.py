from domain.places import PlaceMatch, pick_place
from schemas.geo import GeoPoint


def match(kind, importance, lat, lng, name="Place"):
    return PlaceMatch(
        name=name, point=GeoPoint(lat=lat, lng=lng), radius_km=0, importance=importance, kind=kind
    )


# Real Nominatim settlement answers (India only), November 2026.
def test_the_pilgrimage_town_wins_over_a_far_hamlet_with_the_same_name():
    town = match("town", 0.160, 30.742, 79.493, "Badrinath")
    hamlet = match("hamlet", 0.133, 29.872, 79.580)

    assert pick_place([town, hamlet]) == town


def test_a_smaller_namesake_does_not_make_the_name_ambiguous():
    town = match("town", 0.160, 30.734, 79.067, "Kedarnath")
    village = match("village", 0.147, 29.416, 79.879)

    assert pick_place([town, village]) == town


def test_a_much_less_important_namesake_does_not_make_the_name_ambiguous():
    rajasthan = match("city", 0.524, 24.579, 73.686, "Udaipur")
    region = match("region", 0.462, 24.454, 73.407)
    tripura = match("town", 0.321, 23.542, 91.492)

    assert pick_place([rajasthan, region, tripura]) == rajasthan


def test_a_nearby_boundary_of_the_same_place_is_not_a_rival():
    city = match("city", 0.620, 29.938, 78.145, "Haridwar")
    district = match("region", 0.615, 29.912, 78.009)

    assert pick_place([city, district]) == city


def test_two_equally_known_places_far_apart_are_ambiguous():
    first = match("city", 0.50, 19.877, 75.339)
    second = match("city", 0.48, 24.803, 84.411)

    assert pick_place([first, second]) is None


def test_nothing_found_is_none():
    assert pick_place([]) is None


def test_two_springfields_of_similar_importance_are_ambiguous():
    illinois = match("city", 0.52, 39.7817, -89.6501, "Springfield")
    missouri = match("city", 0.50, 37.2090, -93.2923, "Springfield")

    assert pick_place([illinois, missouri]) is None
