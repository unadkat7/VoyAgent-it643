import logging

import httpx
import pytest
import respx

from adapters.serpapi_client import ACCOUNT_URL, SERPAPI_URL, SerpApiClient, SerpApiError

KEY = "serp-key"


class Clock:
    def __init__(self):
        self.now = 0.0

    def __call__(self) -> float:
        return self.now


def account(left: int, plan: int = 250) -> dict:
    return {"searches_per_month": plan, "total_searches_left": left}


def make_client(clock: Clock | None = None) -> SerpApiClient:
    return SerpApiClient(api_key=KEY, clock=clock or Clock())


@respx.mock
def test_search_sends_key_and_returns_json():
    respx.get(ACCOUNT_URL).respond(200, json=account(250))
    route = respx.get(SERPAPI_URL).respond(200, json={"ok": True})

    assert make_client().get({"engine": "google"}, feature="search") == {"ok": True}
    params = route.calls.last.request.url.params
    assert params["api_key"] == KEY
    assert params["engine"] == "google"


@pytest.mark.parametrize(
    ("feature", "left", "allowed"),
    [
        # Floors: places keep half the plan (125) + 2 spare, web a quarter (63) + 2, search 2.
        ("places", 128, True),
        ("places", 127, False),
        ("web", 66, True),
        ("web", 65, False),
        ("search", 3, True),
        ("search", 2, False),
    ],
)
@respx.mock
def test_each_feature_stops_at_its_floor(feature, left, allowed):
    respx.get(ACCOUNT_URL).respond(200, json=account(left))
    search = respx.get(SERPAPI_URL).respond(200, json={})

    if allowed:
        make_client().get({"engine": "google"}, feature=feature)
    else:
        with pytest.raises(SerpApiError):
            make_client().get({"engine": "google"}, feature=feature)
    assert search.called is allowed


@respx.mock
def test_searches_are_counted_between_account_refreshes():
    account_route = respx.get(ACCOUNT_URL).respond(200, json=account(5))
    respx.get(SERPAPI_URL).respond(200, json={})
    client = make_client()

    client.get({"engine": "google"}, feature="search")
    client.get({"engine": "google"}, feature="search")
    client.get({"engine": "google"}, feature="search")
    with pytest.raises(SerpApiError):
        client.get({"engine": "google"}, feature="search")
    assert account_route.call_count == 1


@respx.mock
def test_allowance_is_read_again_after_ten_minutes():
    account_route = respx.get(ACCOUNT_URL).respond(200, json=account(250))
    respx.get(SERPAPI_URL).respond(200, json={})
    clock = Clock()
    client = make_client(clock)

    client.get({"engine": "google"}, feature="search")
    clock.now = 599
    client.get({"engine": "google"}, feature="search")
    clock.now = 600
    client.get({"engine": "google"}, feature="search")

    assert account_route.call_count == 2


@respx.mock
def test_unknown_allowance_refuses_without_searching():
    respx.get(ACCOUNT_URL).respond(500)
    search = respx.get(SERPAPI_URL).respond(200, json={})

    with pytest.raises(SerpApiError):
        make_client().get({"engine": "google"}, feature="search")
    assert not search.called


@pytest.mark.parametrize("status", [401, 429, 500])
@respx.mock
def test_provider_errors_never_leak_the_key(status):
    respx.get(ACCOUNT_URL).respond(200, json=account(250))
    respx.get(SERPAPI_URL).respond(status, json={"error": "nope"})

    with pytest.raises(SerpApiError) as caught:
        make_client().get({"engine": "google"}, feature="search")
    assert KEY not in str(caught.value)
    assert str(status) in str(caught.value)


@respx.mock
def test_request_logs_never_show_the_key(caplog):
    respx.get(ACCOUNT_URL).respond(200, json=account(250))
    respx.get(SERPAPI_URL).respond(200, json={})

    with caplog.at_level(logging.INFO, logger="httpx"):
        make_client().get({"engine": "google"}, feature="search")

    assert "api_key=REDACTED" in caplog.text
    assert KEY not in caplog.text


@respx.mock
def test_network_failure_becomes_serpapi_error():
    respx.get(ACCOUNT_URL).respond(200, json=account(250))
    respx.get(SERPAPI_URL).mock(side_effect=httpx.ReadTimeout("slow"))

    with pytest.raises(SerpApiError):
        make_client().get({"engine": "google"}, feature="search")
