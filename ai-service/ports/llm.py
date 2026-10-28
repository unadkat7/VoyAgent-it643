from typing import Protocol, TypeVar

from pydantic import BaseModel

M = TypeVar("M", bound=BaseModel)


class LLMError(Exception):
    """Any LLM Provider failure. Adapters must raise only this, so callers can fall back."""


class LLMPort(Protocol):
    def generate(self, output_type: type[M], *, system: str, prompt: str) -> M: ...
