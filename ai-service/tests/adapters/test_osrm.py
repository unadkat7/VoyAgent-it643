import httpx
import pytest
import respx

from adapters.osrm import OsrmRouter
from domain.roads import Drive
from ports.roads import RouteError
from schemas.geo import GeoPoint
from tests.fakes import FakeClock

BASE = "https://osrm.example"
RISHIKESH = GeoPoint(lat=30.109, lng=78.292)
KEDARNATH = GeoPoint(lat=30.734, lng=79.067)
ROUTE_URL = f"{BASE}/route/v1/driving/78.292,30.109;79.067,30.734"
OK = {
    "code": "Ok",
    "routes": [{"distance": 243_000, "duration": 18_720}],
    "waypoints": [{"distance": 13.0}, {"distance": 9_744.0}],
}


def make_router(sleeps=None):
    clock = FakeClock()
    sleeps = sleeps if sleeps is not None else []

    def sleep(seconds):
        sleeps.append(seconds)
        clock.advance(seconds)

    return OsrmRouter(base_url=BASE, clock=clock, sleep=sleep)


@respx.mock
def test_route_becomes_km_hours_and_the_gap_where_the_road_stops():
    route = respx.get(ROUTE_URL).respond(200, json=OK)

    drive = make_router().drive(RISHIKESH, KEDARNATH)

    assert drive == Drive(km=243.0, hours=5.2, end_gap_km=9.744)
    request = route.calls.last.request
    assert request.url.params["overview"] == "false"
    assert "VoyAgent" in request.headers["user-agent"]


@respx.mock
def test_no_road_between_the_places_is_none():
    respx.get(ROUTE_URL).respond(400, json={"code": "NoRoute", "message": "Impossible route"})

    assert make_router().drive(RISHIKESH, KEDARNATH) is None


@respx.mock
def test_the_same_route_is_asked_once():
    route = respx.get(ROUTE_URL).respond(200, json=OK)
    router = make_router()

    router.drive(RISHIKESH, KEDARNATH)
    router.drive(RISHIKESH, KEDARNATH)

    assert route.call_count == 1


@respx.mock
def test_requests_are_spaced_one_second_apart():
    respx.get(url__startswith=f"{BASE}/route/").respond(200, json=OK)
    sleeps = []
    router = make_router(sleeps=sleeps)

    router.drive(RISHIKESH, KEDARNATH)
    router.drive(KEDARNATH, RISHIKESH)

    assert sleeps == [pytest.approx(1.0)]


@pytest.mark.parametrize("status", [429, 500, 503])
@respx.mock
def test_provider_errors_become_route_errors(status):
    respx.get(ROUTE_URL).respond(status)

    with pytest.raises(RouteError):
        make_router().drive(RISHIKESH, KEDARNATH)


@respx.mock
def test_network_failure_becomes_route_error():
    respx.get(ROUTE_URL).mock(side_effect=httpx.ConnectTimeout("slow"))

    with pytest.raises(RouteError):
        make_router().drive(RISHIKESH, KEDARNATH)


@respx.mock
def test_malformed_answer_becomes_route_error():
    respx.get(ROUTE_URL).respond(200, json={"code": "Ok", "routes": []})

    with pytest.raises(RouteError):
        make_router().drive(RISHIKESH, KEDARNATH)
