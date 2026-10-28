"""Test doubles shared by the ai-service tests (see TESTING.md for which kind each one is)."""

from collections.abc import Callable
from typing import TypeVar

from pydantic import BaseModel

from ports.llm import LLMError

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


class FakeClock:
    def __init__(self, start: float = 1_000.0):
        self.now = start

    def __call__(self) -> float:
        return self.now

    def advance(self, seconds: float) -> None:
        self.now += seconds
