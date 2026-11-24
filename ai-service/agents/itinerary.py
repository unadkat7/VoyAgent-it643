from domain.route_rules import route_label, tag_days
from graph.state import PlanningState
from ports.llm import LLMPort
from schemas.itinerary import Itinerary

SYSTEM = """You are the Itinerary planner of VoyAgent.
Create a practical day-by-day Itinerary with Morning, Afternoon and Evening Activities.
Match the Destination, number of days, travel style and interests.
Give each Activity an estimated_cost in {currency} per Traveler for tickets, entry fees, tours and
rides only (0 if free). Meals, food, drinks and local taxis are counted separately, so their
estimated_cost is always 0.
Do not suggest hotels or flights.
Do not assume how the Travelers arrive or leave (flight, train, bus or car). Never name an
airport, railway station or bus stand. On the first day in a new city plan travel and check-in.
Plan around each check-out. Set stop on every day using the zero-based city index."""


def make_itinerary_node(llm: LLMPort):
    def itinerary(state: PlanningState) -> PlanningState:
        if state.get("itinerary") is not None:
            return {}  # a plan edit kept the days (only party size or Budget changed)
        request, dates = state["request"], state["dates"]
        prompt = (
            f"Trip Request: {request.model_dump_json()}\n"
            f"Stops: {route_label(state['route'])}\n"
            f"Travel Dates: {dates.check_in.isoformat()} to {dates.check_out.isoformat()} "
            f"({request.duration_days} days, {dates.nights} nights)."
        )
        result = llm.generate(
            Itinerary, system=SYSTEM.format(currency=request.currency), prompt=prompt
        )
        return {"itinerary": tag_days(result.days, state["route"])}

    return itinerary
