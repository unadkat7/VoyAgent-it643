import logging

from ports.llm import LLMError, LLMPort
from ports.search import FlightQuery, HotelQuery, SearchError
from ports.web_search import WebSearchError, WebSearchPort
from schemas.recommendations import (
    FlightRecommendation,
    FlightRecommendations,
    HotelRecommendation,
    HotelRecommendations,
)

logger = logging.getLogger(__name__)

SYSTEM = (
    "You are a travel pricing assistant for Indian travellers. Suggest realistic options that "
    "exist today, with typical prices in INR. Never claim availability or a confirmed price."
)
MAX_SNIPPET_CHARS = 600


class EstimateSearch:
    """Stand-in when no live Provider answers: LLM-suggested options, always Estimated Cost.

    With a web search Provider, flight fares are grounded in prices found on the web.
    """

    def __init__(self, llm: LLMPort, web: WebSearchPort | None = None):
        self._llm = llm
        self._web = web

    def search_hotels(self, query: HotelQuery) -> list[HotelRecommendation]:
        prompt = (
            f"Suggest up to 3 {query.accommodation_type or 'hotels'} in {query.destination} for "
            f"{query.adults} adults per room from {query.check_in} to {query.check_out}, style "
            f"'{query.travel_style or 'any'}'. Give realistic INR prices per room per night."
        )
        result = self._ask(HotelRecommendations, prompt)
        return [hotel.model_copy(update={"price_source": "estimated"}) for hotel in result.hotels]

    def search_flights(self, query: FlightQuery) -> list[FlightRecommendation]:
        direction = "round-trip" if query.return_date else "one-way"
        returning = f" and returning {query.return_date}" if query.return_date else ""
        prompt = (
            f"Suggest up to 3 {direction} economy flights from {query.origin_airport} to "
            f"{query.destination_airport}, leaving {query.outbound_date}{returning}. "
            f"Give the realistic {direction} fare per traveller in INR, "
            "even if it is high."
        )
        if found := self._web_fares(query):
            prompt += (
                "\nBase the airlines and fares on these web search results for this route and "
                f"month; use only airlines that fly it:\n{found}"
            )
        result = self._ask(FlightRecommendations, prompt)
        return [
            flight.model_copy(update={"price_source": "estimated"}) for flight in result.flights
        ]

    def _web_fares(self, query: FlightQuery) -> str:
        if self._web is None:
            return ""
        direction = "round trip" if query.return_date else "one way"
        month = query.outbound_date.strftime("%B %Y")
        try:
            results = self._web.search(
                f"{query.origin_airport} to {query.destination_airport} {direction} flight "
                f"price {month} INR"
            )
        except WebSearchError as error:
            logger.warning("Web fare search failed, estimating without it: %s", error)
            return ""
        return "\n".join(f"- {r.title} ({r.url}): {r.content[:MAX_SNIPPET_CHARS]}" for r in results)

    def _ask(self, output_type, prompt: str):
        try:
            return self._llm.generate(output_type, system=SYSTEM, prompt=prompt)
        except LLMError as error:
            raise SearchError(f"Estimate search failed: {error}") from error
