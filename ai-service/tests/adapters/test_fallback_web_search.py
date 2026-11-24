from adapters.fallback_web_search import FallbackWebSearch
from ports.web_search import WebResult, WebSearchError

RESULT = WebResult(title="Fare", url="https://fares.example", content="₹500")


class Fixed:
    def __init__(self, results: list[WebResult] | None = None, fail: bool = False):
        self.results = results or []
        self.fail = fail
        self.queries: list[str] = []

    def search(self, query: str) -> list[WebResult]:
        self.queries.append(query)
        if self.fail:
            raise WebSearchError("quota")
        return self.results


def test_primary_answer_is_used_and_fallback_untouched():
    fallback = Fixed([RESULT])

    assert FallbackWebSearch(Fixed([]), fallback).search("fares") == []
    assert fallback.queries == []


def test_primary_failure_asks_the_fallback():
    assert FallbackWebSearch(Fixed(fail=True), Fixed([RESULT])).search("fares") == [RESULT]
