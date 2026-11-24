import pytest

from adapters.web_fares import WebFares
from ports.fares import FareError, FareQuery
from ports.web_search import WebResult, WebSearchError
from schemas.travel import FareRange, TravelFares
from tests.fakes import BrokenLLM, FakeLLM

QUERY = FareQuery(origin="Ahmedabad", destination="Goa", month="December 2026")
RESULT = WebResult(title="AMD-GOA trains", url="https://f.example", content="3AC from ₹1,650")


class FakeWeb:
    def __init__(self, results=None, error=None):
        self._results = results or []
        self._error = error
        self.queries: list[str] = []

    def search(self, query: str):
        self.queries.append(query)
        if self._error:
            raise self._error
        return list(self._results)


def test_train_and_bus_results_are_read_into_fares():
    prompts = []
    fares = TravelFares(train_ac3=FareRange(low=1_650, high=2_100))

    def answer(prompt):
        prompts.append(prompt)
        return fares

    web = FakeWeb([RESULT])

    assert WebFares(web, FakeLLM({TravelFares: answer})).estimate(QUERY) == fares
    assert web.queries == [
        "Ahmedabad to Goa train fare sleeper 3AC December 2026",
        "Ahmedabad to Goa bus fare December 2026",
    ]
    assert "3AC from ₹1,650" in prompts[0]


def test_no_results_means_no_fares_without_asking_the_llm():
    assert WebFares(FakeWeb([]), BrokenLLM()).estimate(QUERY) == TravelFares()


@pytest.mark.parametrize(
    ("web", "llm"),
    [(FakeWeb(error=WebSearchError("quota")), FakeLLM({})), (FakeWeb([RESULT]), BrokenLLM())],
    ids=["search down", "llm down"],
)
def test_failures_become_fare_errors(web, llm):
    with pytest.raises(FareError):
        WebFares(web, llm).estimate(QUERY)
