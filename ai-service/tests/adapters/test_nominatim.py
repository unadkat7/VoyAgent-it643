import httpx
import pytest
import respx

from adapters.nominatim import NominatimGeocoder
from ports.geocoder import GeocodeError
from schemas.geo import GeoPoint
from tests.fakes import FakeClock

URL = "https://nominatim.example/search"


def make_geocoder(clock=None, sleeps=None):
    clock = clock or FakeClock()
    sleeps = sleeps if sleeps is not None else []

    def sleep(seconds):
        sleeps.append(seconds)
        clock.advance(seconds)

    return NominatimGeocoder(base_url="https://nominatim.example", clock=clock, sleep=sleep)


@respx.mock
def test_first_match_becomes_a_point():
    route = respx.get(URL).respond(200, json=[{"lat": "15.5553", "lon": "73.7517"}, {}])

    point = make_geocoder().locate("Baga Beach, Goa")

    assert point == GeoPoint(lat=15.5553, lng=73.7517)
    request = route.calls.last.request
    assert request.url.params["q"] == "Baga Beach, Goa"
    assert request.url.params["format"] == "jsonv2"
    assert request.url.params["limit"] == "1"
    assert "VoyAgent" in request.headers["user-agent"]


@respx.mock
def test_unknown_place_is_none():
    respx.get(URL).respond(200, json=[])

    assert make_geocoder().locate("Nowhere at all") is None


@respx.mock
def test_same_query_is_asked_once():
    route = respx.get(URL).respond(200, json=[{"lat": "1", "lon": "2"}])
    geocoder = make_geocoder()

    geocoder.locate("Goa")
    geocoder.locate("Goa")

    assert route.call_count == 1


@respx.mock
def test_requests_are_spaced_one_second_apart():
    respx.get(URL).respond(200, json=[{"lat": "1", "lon": "2"}])
    sleeps = []
    geocoder = make_geocoder(sleeps=sleeps)

    geocoder.locate("Goa")
    geocoder.locate("Panaji")

    assert sleeps == [pytest.approx(1.0)]


@pytest.mark.parametrize("status", [403, 429, 500])
@respx.mock
def test_provider_errors_become_geocode_errors(status):
    respx.get(URL).respond(status)

    with pytest.raises(GeocodeError):
        make_geocoder().locate("Goa")


@respx.mock
def test_network_failure_becomes_geocode_error():
    respx.get(URL).mock(side_effect=httpx.ConnectTimeout("slow"))

    with pytest.raises(GeocodeError):
        make_geocoder().locate("Goa")


@respx.mock
def test_malformed_answer_becomes_geocode_error():
    respx.get(URL).respond(200, json=[{"lat": "north", "lon": "73"}])

    with pytest.raises(GeocodeError):
        make_geocoder().locate("Goa")
