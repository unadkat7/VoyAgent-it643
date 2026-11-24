from typing import Any

import pytest

from adapters.serpapi_client import SerpApiError
from adapters.serpapi_places import SerpApiPlaces
from ports.place_details import PlaceDetailsError
from schemas.geo import GeoPoint, Region
from tests.fakes import FakeClock

GOA = Region(center=GeoPoint(lat=15.3, lng=74.1), radius_km=120)
FORT = {
    "title": "Fort Aguada",
    "place_id": "ChIJ-fort",
    "rating": 4.4,
    "thumbnail": "https://img.example/fort.jpg",
    "gps_coordinates": {"latitude": 15.49, "longitude": 73.77},
}


class FakeClient:
    def __init__(self, payload: dict[str, Any] | None = None, error: bool = False):
        self.payload = payload or {}
        self.error = error
        self.calls: list[tuple[dict[str, Any], str]] = []

    def get(self, params: dict[str, Any], *, feature: str) -> dict[str, Any]:
        self.calls.append((params, feature))
        if self.error:
            raise SerpApiError("SerpAPI places paused")
        return self.payload


def test_exact_place_is_mapped_with_a_google_maps_link():
    client = FakeClient({"place_results": FORT})

    details = SerpApiPlaces(client).lookup("Fort Aguada, Goa", near=GOA)

    assert details.point == GeoPoint(lat=15.49, lng=73.77)
    assert details.rating == 4.4
    assert details.image_url == "https://img.example/fort.jpg"
    assert details.maps_url == (
        "https://www.google.com/maps/search/?api=1&query=Fort+Aguada&query_place_id=ChIJ-fort"
    )
    params, feature = client.calls[0]
    assert feature == "places"
    assert params["engine"] == "google_maps"
    assert params["q"] == "Fort Aguada, Goa"
    assert params["ll"] == "@15.3,74.1,12z"


def test_first_local_result_is_used_and_no_match_is_none():
    assert SerpApiPlaces(FakeClient({"local_results": [FORT, {}]})).lookup("Fort").rating == 4.4
    assert SerpApiPlaces(FakeClient({})).lookup("Nowhere") is None


def test_answers_are_cached_until_they_expire():
    client = FakeClient({"place_results": FORT})
    clock = FakeClock()
    places = SerpApiPlaces(client, cache_seconds=60, clock=clock)

    places.lookup("Fort Aguada, Goa")
    places.lookup("Fort Aguada, Goa")
    clock.advance(60)
    places.lookup("Fort Aguada, Goa")

    assert len(client.calls) == 2


def test_refusal_becomes_place_details_error():
    with pytest.raises(PlaceDetailsError):
        SerpApiPlaces(FakeClient(error=True)).lookup("Fort Aguada, Goa")
