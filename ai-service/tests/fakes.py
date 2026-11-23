"""Test doubles shared by the ai-service tests (see TESTING.md for which kind each one is)."""

from collections.abc import Callable
from typing import TypeVar

from pydantic import BaseModel

from ports.llm import LLMError
from schemas.geo import GeoPoint, Region

M = TypeVar("M", bound=BaseModel)


class FakeLLM:
    """Fake LLMPort: answers each output type with a canned model, or builds one from the prompt."""

    def __init__(self, answers: dict[type[BaseModel], BaseModel | Callable[[str], BaseModel]]):
        self._answers = answers

    def generate(self, output_type: type[M], *, system: str, prompt: str) -> M:
        answer = self._answers[output_type]
        return answer(prompt) if callable(answer) else answer


class BrokenLLM:
    """Stub LLMPort that is always down."""

    def __init__(self, reason: str = "provider down"):
        self.reason = reason

    def generate(self, output_type, *, system: str, prompt: str):
        raise LLMError(self.reason)


class SequenceSearch:
    """Stub search port: each call returns (or raises) the next prepared answer."""

    def __init__(self, *answers):
        self._answers = list(answers)

    def _next(self, _query):
        answer = self._answers.pop(0)
        if isinstance(answer, Exception):
            raise answer
        return answer

    search_hotels = _next
    search_flights = _next


class FakeGeocoder:
    """Fake GeocoderPort: knows a fixed set of places and records every query it is asked."""

    def __init__(self, places: dict | None = None, error: Exception | None = None):
        self._places = places or {}
        self._error = error
        self.queries: list[str] = []

    def locate(self, query: str, near=None):
        answer = self._answer(query)
        return answer.center if isinstance(answer, Region) else answer

    def locate_area(self, query: str):
        answer = self._answer(query)
        return Region(center=answer, radius_km=0) if isinstance(answer, GeoPoint) else answer

    def _answer(self, query: str):
        self.queries.append(query)
        if self._error:
            raise self._error
        return self._places.get(query)


class FakeTimetable:
    """Fake TimetablePort: hands back a prepared Timetable, or raises."""

    def __init__(self, timetable=None, error: Exception | None = None):
        self._timetable = timetable
        self._error = error

    def load(self):
        if self._error:
            raise self._error
        return self._timetable


class FakePlaces:
    """Fake PlaceFinderPort: knows a fixed set of names and records every name it is asked."""

    def __init__(self, places: dict | None = None, error: Exception | None = None):
        self._places = places or {}
        self._error = error
        self.queries: list[str] = []

    def find_settlements(self, name: str):
        self.queries.append(name)
        if self._error:
            raise self._error
        return self._places.get(name, [])


class FakeRouter:
    """Fake RouterPort: answers by end point name from a fixed table, with a default drive."""

    def __init__(self, drives: dict | None = None, default=None, error: Exception | None = None):
        self._drives = drives or {}
        self._default = default
        self._error = error
        self.calls: list[tuple] = []

    def drive(self, start, end):
        self.calls.append((start, end))
        if self._error:
            raise self._error
        return self._drives.get((start.lat, start.lng, end.lat, end.lng), self._default)


class FakeClock:
    def __init__(self, start: float = 1_000.0):
        self.now = start

    def __call__(self) -> float:
        return self.now

    def advance(self, seconds: float) -> None:
        self.now += seconds
