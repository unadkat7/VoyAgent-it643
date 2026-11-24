from domain.money import format_money
from domain.route_rules import route_label
from domain.spend import rooms_for
from graph.state import PlanningState
from ports.llm import LLMPort
from schemas.plan import EstimatedCost, Stop, TripPlan, TripSummary
from schemas.trip_request import TripRequest

SYSTEM = """You are the writer of VoyAgent. Write a short, friendly summary of the Trip plan
and 3 to 5 practical tips for the Destination. Do not invent prices, hotels, flights, trains,
train times or road distances. If some details were assumed, do not present them as the
Traveler's own choices."""

# What each field is called when asking the Traveler for it.
FOLLOW_UP_LABELS = {
    "origin": "starting city",
    "duration_days": "number of days",
    "party_size": "group size",
    "travel_style": "travel style",
    "budget": "budget",
}


def assumption_lines(request: TripRequest, assumed: list[str]) -> list[str]:
    lines = {
        "origin": "No starting city, so flights, trains and the drive are left out.",
        "duration_days": f"{request.duration_days} days, since you didn't say how long.",
        "party_size": f"{request.party_size} travellers, since you didn't say how many.",
        "travel_style": f"A {request.travel_style} pace, since you didn't pick a style.",
        "budget": (
            f"A budget of about {format_money(request.budget, request.currency)} for everyone, "
            "since you didn't give one."
        ),
    }
    return [lines[field] for field in assumed if field in lines]


def follow_up_question(assumed: list[str]) -> str | None:
    labels = [FOLLOW_UP_LABELS[field] for field in assumed if field in FOLLOW_UP_LABELS]
    if not labels:
        return None
    asked = labels[0] if len(labels) == 1 else f"{', '.join(labels[:-1])} and {labels[-1]}"
    return f"Tell me your {asked} (and dates, if you know them) and I'll fine-tune this plan."


def make_compose_node(llm: LLMPort):
    def compose(state: PlanningState) -> PlanningState:
        request, dates, cost = state["request"], state["dates"], state["cost"]
        hotels, flights = state.get("hotels", []), state.get("flights", [])
        itinerary = state.get("itinerary", [])
        # Parallel steps can report the same problem; each Note is shown once.
        notes = list(dict.fromkeys(state.get("notes", [])))
        trains_out = state.get("trains_out", [])
        road_route, road_leg = state.get("road_route"), state.get("road_leg")
        assumed = state.get("assumed_fields", [])
        assumptions = assumption_lines(request, assumed)
        prompt = (
            f"Trip Request: {request.model_dump_json()}\n"
            f"Stops: {route_label(state['route'])}\n"
            f"Assumed, not stated by the Traveler: {assumptions}\n"
            f"Stays: {[h.name for h in hotels]}\n"
            f"Flights: {[f.airline for f in flights]}\n"
            f"Ways to travel: {[o.label for o in state.get('travel_options', [])]}\n"
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
            stops=[
                Stop(
                    **stop.model_dump(),
                    check_in=period.check_in.isoformat(),
                    check_out=period.check_out.isoformat(),
                    nights=period.nights,
                    hotels=group,
                    coordinates=point,
                )
                for stop, period, group, point in zip(
                    state["route"],
                    state["stop_dates"],
                    state["stop_hotels"],
                    state["stop_points"],
                    strict=True,
                )
            ],
            legs=state.get("legs", []),
            hotels=hotels,
            flights=flights,
            itinerary=itinerary,
            estimated_cost=EstimatedCost(
                hotel_total=float(cost.hotel_total),
                currency=cost.currency,
                legs_total=state.get("legs_total", 0),
                travel_total=float(cost.travel_total),
                travel_mode=state.get("travel_mode"),
                activities_total=float(cost.activities_total),
                daily_spend_total=float(cost.daily_spend_total),
                total=float(cost.total),
                rooms=rooms_for(request.party_size),
                per_person=round(float(cost.total) / request.party_size),
            ),
            notes=notes,
            destination_coordinates=state.get("destination_point"),
            trains_out=trains_out,
            trains_back=state.get("trains_back", []),
            road_route=road_route,
            road_leg=road_leg,
            timetable_as_of=state.get("timetable_as_of"),
            travel_options=state.get("travel_options", []),
            assumed_fields=assumed,
            assumptions=assumptions,
            follow_up=follow_up_question(assumed),
        )
        return {"plan": plan}

    return compose
