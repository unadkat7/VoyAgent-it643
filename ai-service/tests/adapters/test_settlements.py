import httpx
import pytest
import respx

from adapters.nominatim import NominatimGeocoder
from ports.geocoder import GeocodeError
from schemas.geo import GeoPoint
from tests.fakes import FakeClock

URL = "https://nominatim.example/search"

BADRINATH = [
    {
        "lat": "30.742",
        "lon": "79.493",
        "importance": 0.160,
        "category": "place",
        "type": "town",
        "name": "Badrinath",
        "boundingbox": ["30.72", "30.76", "79.47", "79.51"],
    },
    {
        "lat": "29.872",
        "lon": "79.580",
        "importance": 0.133,
        "category": "place",
        "type": "hamlet",
        "name": "Badrinath",
    },
    {
        "lat": "15.30",
        "lon": "74.08",
        "importance": 0.649,
        "category": "boundary",
        "type": "administrative",
        "name": "Goa",
    },
]


def make_geocoder():
    clock = FakeClock()

    def sleep(seconds):
        clock.advance(seconds)

    return NominatimGeocoder(base_url="https://nominatim.example", clock=clock, sleep=sleep)


@respx.mock
def test_settlements_are_searched_in_india_only():
    route = respx.get(URL).respond(200, json=BADRINATH)

    make_geocoder().find_settlements("Badrinath")

    params = route.calls.last.request.url.params
    assert params["q"] == "Badrinath"
    assert params["featureType"] == "settlement"
    assert params["countrycodes"] == "in"
    assert params["limit"] == "5"


@respx.mock
def test_each_match_keeps_its_rank_kind_and_size():
    respx.get(URL).respond(200, json=BADRINATH)

    town, hamlet, region = make_geocoder().find_settlements("Badrinath")

    assert town.name == "Badrinath"
    assert town.point == GeoPoint(lat=30.742, lng=79.493)
    assert town.importance == pytest.approx(0.160)
    assert town.kind == "town"
    assert 1 < town.radius_km < 5
    assert hamlet.kind == "hamlet"
    assert hamlet.radius_km == 0
    assert region.kind == "region"


@respx.mock
def test_no_matches_is_an_empty_list():
    respx.get(URL).respond(200, json=[])

    assert make_geocoder().find_settlements("Nowhere") == []


@respx.mock
def test_the_same_name_is_asked_once():
    route = respx.get(URL).respond(200, json=BADRINATH)
    geocoder = make_geocoder()

    geocoder.find_settlements("Badrinath")
    geocoder.find_settlements("Badrinath")

    assert route.call_count == 1


@respx.mock
def test_failures_become_geocode_errors():
    respx.get(URL).mock(side_effect=httpx.ConnectTimeout("slow"))

    with pytest.raises(GeocodeError):
        make_geocoder().find_settlements("Badrinath")
