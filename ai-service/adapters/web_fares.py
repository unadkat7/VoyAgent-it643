from ports.fares import FareError, FareQuery
from ports.llm import LLMError, LLMPort
from ports.web_search import WebSearchError, WebSearchPort
from schemas.travel import TravelFares

SYSTEM = """You read web search results about Indian train and bus fares.
Return one-way fares per person in INR as low-high ranges: train_sleeper (Sleeper class),
train_ac3 (3rd AC) and bus. Use only fares the results support for this route; leave a mode
null when the results don't show it. Never invent a fare."""
MAX_SNIPPET_CHARS = 500


class WebFares:
    """Approximate train and bus fares: web search results read by the LLM, always estimates."""

    def __init__(self, web: WebSearchPort, llm: LLMPort):
        self._web = web
        self._llm = llm

    def estimate(self, query: FareQuery) -> TravelFares:
        route = f"{query.origin} to {query.destination}"
        try:
            results = self._web.search(f"{route} train fare sleeper 3AC {query.month}")
            results += self._web.search(f"{route} bus fare {query.month}")
        except WebSearchError as error:
            raise FareError(f"Fare search failed: {error}") from error
        if not results:
            return TravelFares()
        snippets = "\n".join(
            f"- {r.title} ({r.url}): {r.content[:MAX_SNIPPET_CHARS]}" for r in results
        )
        try:
            return self._llm.generate(
                TravelFares, system=SYSTEM, prompt=f"Route: {route}\nResults:\n{snippets}"
            )
        except LLMError as error:
            raise FareError(f"Reading fares failed: {error}") from error
