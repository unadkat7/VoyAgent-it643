from ports.fares import FareError, FareQuery, TrainSegment
from ports.llm import LLMError, LLMPort
from ports.web_search import WebResult, WebSearchError, WebSearchPort
from schemas.travel import TrainFare, TrainFares, TravelFares

SYSTEM = """You read web search results about Indian train and bus fares.
Return one-way fares per person in INR as low-high ranges: train_sleeper (Sleeper class),
train_ac3 (3rd AC) and bus. Use only fares the results support for this route; leave a mode
null when the results don't show it. Never invent a fare."""
TRAIN_SYSTEM = """You read web search results about fares for specific Indian trains.
For each listed train number, return its one-way fare per person in INR between the listed
stations as low-high ranges: sleeper (Sleeper class) and ac3 (3rd AC). Use only fares the
results show for that train; leave a class null, or leave the train out, when they don't.
Never invent a fare."""
MAX_SNIPPET_CHARS = 500


def _snippets(results: list[WebResult]) -> str:
    return "\n".join(f"- {r.title} ({r.url}): {r.content[:MAX_SNIPPET_CHARS]}" for r in results)


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
        try:
            return self._llm.generate(
                TravelFares, system=SYSTEM, prompt=f"Route: {route}\nResults:\n{_snippets(results)}"
            )
        except LLMError as error:
            raise FareError(f"Reading fares failed: {error}") from error

    def train_fares(self, segments: list[TrainSegment], month: str) -> list[TrainFare]:
        """One search per train, then one LLM read of all of them."""
        sections = []
        for s in segments:
            train = f"{s.train_number} {s.train_name} {s.from_station} to {s.to_station}"
            try:
                results = self._web.search(f"{train} train fare sleeper 3AC {month}")
            except WebSearchError as error:
                raise FareError(f"Train fare search failed: {error}") from error
            if results:
                sections.append(f"Train {train}:\n{_snippets(results)}")
        if not sections:
            return []
        try:
            found = self._llm.generate(
                TrainFares, system=TRAIN_SYSTEM, prompt="\n\n".join(sections)
            )
        except LLMError as error:
            raise FareError(f"Reading train fares failed: {error}") from error
        asked = {s.train_number for s in segments}
        return [fare for fare in found.fares if fare.train_number in asked]
