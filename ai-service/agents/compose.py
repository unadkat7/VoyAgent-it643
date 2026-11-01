from graph.state import PlanningState
from ports.llm import LLMPort
from schemas.plan import EstimatedCost, TripPlan, TripSummary

SYSTEM = """You are the writer of VoyAgent. Write a short, friendly summary of the Trip plan
and 3 to 5 practical tips for the Destination. Do not invent prices, hotels or flights."""


def make_compose_node(llm: LLMPort):
    def compose(state: PlanningState) -> PlanningState:
        request, dates, cost = state["request"], state["dates"], state["cost"]
        hotels, flights = state.get("hotels", []), state.get("flights", [])
        itinerary, notes = state.get("itinerary", []), state.get("notes", [])
        prompt = (
            f"Trip Request: {request.model_dump_json()}\n"
            f"Stays: {[h.name for h in hotels]}\n"
            f"Flights: {[f.airline for f in flights]}\n"
            f"Days: {[day.title for day in itinerary]}\n"
            f"Notes: {notes}"
        )
        summary = llm.generate(TripSummary, system=SYSTEM, prompt=prompt)

        # Recommendations pass through untouched; only the prose comes from the LLM.
        plan = TripPlan(
            summary=summary.summary,
            important_tips=summary.important_tips,
            request=request,
            check_in=dates.check_in.isoformat(),
            check_out=dates.check_out.isoformat(),
            nights=dates.nights,
            hotels=hotels,
            flights=flights,
            itinerary=itinerary,
            estimated_cost=EstimatedCost(
                hotel_total=float(cost.hotel_total),
                flight_total=float(cost.flight_total),
                total=float(cost.total),
            ),
            notes=notes,
        )
        return {"plan": plan}

    return compose
