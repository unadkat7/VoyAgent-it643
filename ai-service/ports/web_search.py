from dataclasses import dataclass
from typing import Protocol


class WebSearchError(Exception):
    """Any web search Provider failure (quota, network, bad response)."""


@dataclass(frozen=True)
class WebResult:
    title: str
    url: str
    content: str


class WebSearchPort(Protocol):
    def search(self, query: str) -> list[WebResult]: ...
