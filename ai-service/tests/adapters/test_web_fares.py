import pytest

from adapters.web_fares import WebFares
from ports.fares import FareError, FareQuery, TrainSegment
from ports.web_search import WebResult, WebSearchError
from schemas.travel import FareRange, TrainFare, TrainFares, TravelFares
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


SEGMENTS = [
    TrainSegment("12911", "Bl Haridwar Exp", "Surat", "Haridwar Jn"),
    TrainSegment("12912", "Hw Bl Exp", "Haridwar Jn", "Surat"),
]


def test_each_train_is_searched_by_number_and_stations_and_read_in_one_go():
    prompts = []
    fares = TrainFares(
        fares=[
            TrainFare(train_number="12911", ac3=FareRange(low=1_800, high=2_100)),
            TrainFare(train_number="99999", ac3=FareRange(low=1, high=2)),
        ]
    )

    def answer(prompt):
        prompts.append(prompt)
        return fares

    web = FakeWeb([RESULT])

    found = WebFares(web, FakeLLM({TrainFares: answer})).train_fares(SEGMENTS, "December 2026")

    assert web.queries == [
        "12911 Bl Haridwar Exp Surat to Haridwar Jn train fare sleeper 3AC December 2026",
        "12912 Hw Bl Exp Haridwar Jn to Surat train fare sleeper 3AC December 2026",
    ]
    assert len(prompts) == 1
    assert [fare.train_number for fare in found] == ["12911"]


@pytest.mark.parametrize(
    ("web", "llm"),
    [(FakeWeb(error=WebSearchError("quota")), FakeLLM({})), (FakeWeb([RESULT]), BrokenLLM())],
    ids=["search down", "llm down"],
)
def test_failures_become_fare_errors(web, llm):
    with pytest.raises(FareError):
        WebFares(web, llm).estimate(QUERY)
