import pytest

from adapters.fallback_search import FallbackSearch
from ports.search import SearchError
from schemas.recommendations import FlightRecommendation, HotelRecommendation
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


def test_no_live_hotels_is_an_answer_not_a_failure():
    search = FallbackSearch(SequenceSearch([]), SequenceSearch(ESTIMATED))

    assert search.search_hotels("query") == []


def test_no_live_flights_falls_back_to_estimated_fares():
    estimated = [
        FlightRecommendation(
            airline="IndiGo",
            departure_airport="AMD",
            arrival_airport="GOI",
            price_per_traveler=6500,
        )
    ]
    search = FallbackSearch(SequenceSearch([]), SequenceSearch(estimated))

    assert search.search_flights("query") == estimated


def test_failed_live_flights_ask_the_fallback_once():
    # A second fallback call would pop from an empty SequenceSearch and fail.
    search = FallbackSearch(SequenceSearch(SearchError("quota")), SequenceSearch([]))

    assert search.search_flights("query") == []


def test_error_is_raised_when_both_searches_fail():
    search = FallbackSearch(
        SequenceSearch(SearchError("quota")), SequenceSearch(SearchError("llm down"))
    )

    with pytest.raises(SearchError):
        search.search_hotels("query")
