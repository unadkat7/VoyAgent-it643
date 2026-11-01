from langgraph.graph import END

from domain.feasibility import estimate_trip_cost, is_within_budget
from graph.state import PlanningState
from schemas.api import Clarification


def budget_check(state: PlanningState) -> PlanningState:
    """Rule 3: plan only when a stay fits the Budget; otherwise ask the Traveler to adjust it."""
    request, dates, caps = state["request"], state["dates"], state["caps"]

    if state.get("hotels_over_budget"):
        question = (
            f"The cheapest stay I found in {request.destination} costs "
            f"₹{state['cheapest_hotel_price']:,.0f} per night, but your ₹{request.budget:,} "
            f"Budget allows about ₹{caps.hotel_search_limit:,} per night for {dates.nights} "
            "nights. Could you raise the Budget, shorten the Trip, or pick another Destination?"
        )
        return {"clarification": Clarification(missing_fields=["budget"], question=question)}

    hotels, flights = state.get("hotels", []), state.get("flights", [])
    cost = estimate_trip_cost(
        hotel_price_per_night=min((h.price_per_night for h in hotels), default=None),
        nights=dates.nights,
        flight_price_per_traveler=min((f.price_per_traveler for f in flights), default=None),
        party_size=request.party_size,
    )
    # Guard: the caps keep this true today, but the shares are tunable constants.
    if not is_within_budget(cost, request.budget):
        question = (
            f"The stay and flights I found come to about ₹{float(cost.total):,.0f}, which is over "
            f"your ₹{request.budget:,} Budget. Could you raise the Budget or shorten the Trip?"
        )
        return {"clarification": Clarification(missing_fields=["budget"], question=question)}
    return {"cost": cost}


def route_after_budget_check(state: PlanningState) -> str:
    return END if state.get("clarification") else "compose"
