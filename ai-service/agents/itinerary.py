from graph.state import PlanningState
from ports.llm import LLMPort
from schemas.itinerary import Itinerary

SYSTEM = """You are the Itinerary planner of VoyAgent.
Create a practical day-by-day Itinerary with Morning, Afternoon and Evening Activities.
Match the Destination, number of days, travel style and interests.
Give each Activity an estimated_cost in INR per Traveler (0 if free).
Do not suggest hotels or flights."""


def make_itinerary_node(llm: LLMPort):
    def itinerary(state: PlanningState) -> PlanningState:
        request, dates = state["request"], state["dates"]
        prompt = (
            f"Trip Request: {request.model_dump_json()}\n"
            f"Travel Dates: {dates.check_in.isoformat()} to {dates.check_out.isoformat()} "
            f"({request.duration_days} days)."
        )
        result = llm.generate(Itinerary, system=SYSTEM, prompt=prompt)
        return {"itinerary": result.days}

    return itinerary
