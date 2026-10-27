import pytest

from adapters.cached_search import CachedSearch
from ports.search import SearchError
from tests.fakes import FakeClock, SequenceSearch

FIRST = ["first answer"]
SECOND = ["second answer"]
TTL = 3600


def test_repeated_query_within_ttl_gets_the_cached_answer():
    search = CachedSearch(SequenceSearch(FIRST, SECOND), ttl_seconds=TTL, clock=FakeClock())

    assert search.search_hotels("goa-dec") == FIRST
    assert search.search_hotels("goa-dec") == FIRST


def test_query_after_ttl_asks_the_provider_again():
    clock = FakeClock()
    search = CachedSearch(SequenceSearch(FIRST, SECOND), ttl_seconds=TTL, clock=clock)

    search.search_hotels("goa-dec")
    clock.advance(TTL + 1)

    assert search.search_hotels("goa-dec") == SECOND


def test_different_queries_are_cached_separately():
    search = CachedSearch(SequenceSearch(FIRST, SECOND), ttl_seconds=TTL, clock=FakeClock())

    assert search.search_hotels("goa-dec") == FIRST
    assert search.search_hotels("manali-jan") == SECOND


def test_hotel_and_flight_answers_do_not_mix():
    search = CachedSearch(SequenceSearch(FIRST, SECOND), ttl_seconds=TTL, clock=FakeClock())

    assert search.search_hotels("same-key") == FIRST
    assert search.search_flights("same-key") == SECOND


def test_failures_are_not_cached():
    search = CachedSearch(
        SequenceSearch(SearchError("blip"), FIRST), ttl_seconds=TTL, clock=FakeClock()
    )

    with pytest.raises(SearchError):
        search.search_hotels("goa-dec")
    assert search.search_hotels("goa-dec") == FIRST
