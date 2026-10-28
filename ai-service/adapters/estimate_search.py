from ports.llm import LLMError, LLMPort
from ports.search import FlightQuery, HotelQuery, SearchError
from schemas.recommendations import (
    FlightRecommendation,
    FlightRecommendations,
    HotelRecommendation,
    HotelRecommendations,
)

SYSTEM = (
    "You are a travel pricing assistant for Indian travellers. Suggest realistic options that "
    "exist today, with typical prices in INR. Never claim availability or a confirmed price."
)


class EstimateSearch:
    """Stand-in when no live Provider answers: LLM-suggested options, always Estimated Cost."""

    def __init__(self, llm: LLMPort):
        self._llm = llm

    def search_hotels(self, query: HotelQuery) -> list[HotelRecommendation]:
        prompt = (
            f"Suggest up to 3 {query.accommodation_type or 'hotels'} in {query.destination} for "
            f"{query.adults} adults from {query.check_in} to {query.check_out}, style "
            f"'{query.travel_style or 'any'}', each at most "
            f"{query.max_price_per_night} INR per night."
        )
        result = self._ask(HotelRecommendations, prompt)
        return [hotel.model_copy(update={"price_source": "estimated"}) for hotel in result.hotels]

    def search_flights(self, query: FlightQuery) -> list[FlightRecommendation]:
        prompt = (
            f"Suggest up to 3 round-trip economy flights from {query.origin_airport} to "
            f"{query.destination_airport}, leaving {query.outbound_date} and returning "
            f"{query.return_date}, each at most {query.max_price_per_traveler} INR per traveller."
        )
        result = self._ask(FlightRecommendations, prompt)
        return [
            flight.model_copy(update={"price_source": "estimated"}) for flight in result.flights
        ]

    def _ask(self, output_type, prompt: str):
        try:
            return self._llm.generate(output_type, system=SYSTEM, prompt=prompt)
        except LLMError as error:
            raise SearchError(f"Estimate search failed: {error}") from error
