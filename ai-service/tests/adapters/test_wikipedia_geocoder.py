import httpx
import pytest
import respx

from adapters.fallback_geocoder import FallbackGeocoder
from adapters.wikipedia_geocoder import WikipediaGeocoder
from ports.geocoder import GeocodeError
from schemas.geo import GeoPoint, Region
from tests.fakes import FakeClock, FakeGeocoder

URL = "https://wiki.example/api"


@respx.mock
def test_landmark_matches_exact_wikipedia_coordinates():
    respx.get(URL).respond(
        200,
        json={
            "query": {
                "pages": {
                    "1": {
                        "index": 1,
                        "title": "Mahakaleshwar Jyotirlinga",
                        "coordinates": [{"lat": 23.18277778, "lon": 75.76833333}],
                    },
                    "2": {
                        "index": 2,
                        "title": "Ujjain",
                        "coordinates": [{"lat": 23.17, "lon": 75.79}],
                    },
                }
            }
        },
    )

    point = WikipediaGeocoder(api_url=URL).locate("Mahakaleshwar Temple, Ujjain")

    assert point == GeoPoint(lat=23.18277778, lng=75.76833333)


@respx.mock
def test_bare_destination_city_is_ignored_and_not_fetched():
    route = respx.get(URL).respond(200, json={})

    assert WikipediaGeocoder(api_url=URL).locate("Ujjain") is None
    assert route.call_count == 0


@respx.mock
def test_generic_city_article_or_partial_match_is_rejected():
    respx.get(URL).respond(
        200,
        json={
            "query": {
                "pages": {
                    "1": {
                        "index": 1,
                        "title": "Ujjain",
                        "coordinates": [{"lat": 23.17, "lon": 75.79}],
                    },
                    "2": {
                        "index": 2,
                        "title": "Maharishi Sandipani Rashtriya Ved Vidya Pratishthan",
                        "coordinates": [{"lat": 23.132, "lon": 75.737}],
                    },
                }
            }
        },
    )

    assert WikipediaGeocoder(api_url=URL).locate("Sandipani Ashram, Ujjain") is None


def test_fallback_geocoder_falls_back_when_primary_misses_or_errors():
    ram_ghat = GeoPoint(lat=23.1887, lng=75.7649)
    broken = FakeGeocoder(error=GeocodeError("timeout"))
    nominatim = FakeGeocoder({"Ram Ghat, Ujjain": ram_ghat})

    assert FallbackGeocoder(broken, nominatim).locate("Ram Ghat, Ujjain") == ram_ghat
    assert FallbackGeocoder(FakeGeocoder(), nominatim).locate("Ram Ghat, Ujjain") == ram_ghat


def test_fallback_is_asked_when_primary_pin_is_outside_the_area():
    ujjain = Region(center=GeoPoint(lat=23.18, lng=75.78), radius_km=120)
    namesake = GeoPoint(lat=28.61, lng=77.21)
    right = GeoPoint(lat=23.1887, lng=75.7649)
    primary = FakeGeocoder({"Ram Ghat, Ujjain": namesake})
    fallback = FakeGeocoder({"Ram Ghat, Ujjain": right})

    assert FallbackGeocoder(primary, fallback).locate("Ram Ghat, Ujjain", near=ujjain) == right


def test_failed_primary_is_skipped_until_its_cooldown_ends():
    clock = FakeClock()
    broken = FakeGeocoder(error=GeocodeError("timeout"))
    geocoder = FallbackGeocoder(broken, FakeGeocoder(), cooldown_seconds=300, clock=clock)

    geocoder.locate("Ram Ghat, Ujjain")
    geocoder.locate("Harsiddhi Temple, Ujjain")
    assert len(broken.queries) == 1

    clock.advance(301)
    geocoder.locate("Harsiddhi Temple, Ujjain")
    assert len(broken.queries) == 2


def test_areas_come_from_the_fallback():
    goa = Region(center=GeoPoint(lat=15.3, lng=74.1), radius_km=80)

    assert FallbackGeocoder(FakeGeocoder(), FakeGeocoder({"Goa": goa})).locate_area("Goa") == goa


@respx.mock
def test_http_failure_raises_geocode_error():
    respx.get(URL).mock(side_effect=httpx.ConnectTimeout("slow"))

    with pytest.raises(GeocodeError):
        WikipediaGeocoder(api_url=URL).locate("Mahakaleshwar Temple, Ujjain")
