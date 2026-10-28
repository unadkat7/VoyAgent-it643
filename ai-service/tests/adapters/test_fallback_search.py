import pytest

from adapters.fallback_search import FallbackSearch
from ports.search import SearchError
from schemas.recommendations import HotelRecommendation
from tests.fakes import SequenceSearch

LIVE = [
    HotelRecommendation(
        name="Live Hotel", location="Goa", price_per_night=3000, price_source="live"
    )
]
ESTIMATED = [HotelRecommendation(name="Estimated Hotel", location="Goa", price_per_night=2800)]


def test_live_results_are_used_when_the_provider_works():
    search = FallbackSearch(SequenceSearch(LIVE), SequenceSearch(ESTIMATED))

    assert search.search_hotels("query") == LIVE


def test_estimates_are_used_when_the_provider_fails():
    search = FallbackSearch(SequenceSearch(SearchError("quota used up")), SequenceSearch(ESTIMATED))

    assert search.search_hotels("query") == ESTIMATED


def test_no_live_results_is_an_answer_not_a_failure():
    # Empty means nothing fits the cap; inventing estimates here would hide that.
    search = FallbackSearch(SequenceSearch([]), SequenceSearch(ESTIMATED))

    assert search.search_flights("query") == []


def test_error_is_raised_when_both_searches_fail():
    search = FallbackSearch(
        SequenceSearch(SearchError("quota")), SequenceSearch(SearchError("llm down"))
    )

    with pytest.raises(SearchError):
        search.search_hotels("query")
