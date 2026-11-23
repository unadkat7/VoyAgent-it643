from graph.state import PlanningState
from ports.llm import LLMPort
from schemas.plan import EstimatedCost, TripPlan, TripSummary

SYSTEM = """You are the writer of VoyAgent. Write a short, friendly summary of the Trip plan
and 3 to 5 practical tips for the Destination. Do not invent prices, hotels, flights, trains,
train times or road distances."""


def make_compose_node(llm: LLMPort):
    def compose(state: PlanningState) -> PlanningState:
        request, dates, cost = state["request"], state["dates"], state["cost"]
        hotels, flights = state.get("hotels", []), state.get("flights", [])
        itinerary = state.get("itinerary", [])
        # Parallel steps can report the same problem; each Note is shown once.
        notes = list(dict.fromkeys(state.get("notes", [])))
        trains_out = state.get("trains_out", [])
        road_route, road_leg = state.get("road_route"), state.get("road_leg")
        prompt = (
            f"Trip Request: {request.model_dump_json()}\n"
            f"Stays: {[h.name for h in hotels]}\n"
            f"Flights: {[f.airline for f in flights]}\n"
            f"Trains: {[[leg.train_name for leg in t.legs] for t in trains_out]}\n"
            f"Last leg by road: {road_leg.model_dump_json() if road_leg else None}\n"
            f"Whole way by road: {road_route.model_dump_json() if road_route else None}\n"
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
            destination_coordinates=state.get("destination_point"),
            trains_out=trains_out,
            trains_back=state.get("trains_back", []),
            road_route=road_route,
            road_leg=road_leg,
            timetable_as_of=state.get("timetable_as_of"),
        )
        return {"plan": plan}

    return compose
