from langgraph.graph import END

from domain.feasibility import estimate_trip_cost, is_within_budget
from domain.spend import daily_spend_per_traveler, rooms_for
from domain.travel_costs import chosen_option, travel_options
from graph.state import PlanningState
from schemas.api import Clarification


def budget_check(state: PlanningState) -> PlanningState:
    """Rule 3: plan only when a stay fits the Budget; otherwise ask the Traveler to adjust it.

    A Budget the Traveler never gave is only a guess, so it never blocks a plan.
    """
    request, dates, caps = state["request"], state["dates"], state["caps"]
    budget_guessed = "budget" in state.get("assumed_fields", [])
    if state.get("hotels_over_budget") and not budget_guessed:
        question = (
            f"The cheapest stay I found in {state['over_budget_city']} costs "
            f"₹{state['cheapest_hotel_price']:,.0f} per night, but your ₹{request.budget:,} "
            f"Budget allows about ₹{caps.hotel_search_limit:,} per night for {dates.nights} "
            "nights. Could you raise the Budget, shorten the Trip, or pick another Destination?"
        )
        return {"clarification": Clarification(missing_fields=["budget"], question=question)}
    options = state.get("travel_options")
    if options is None:
        road = state.get("road_route")
        options = travel_options(
            flights=state.get("flights", []),
            fares=state.get("fares"),
            road_km=road.distance_km if road else None,
            party_size=request.party_size,
        )
    travel = chosen_option(options, state.get("travel_mode"))
    activities = sum(
        activity.estimated_cost for day in state.get("itinerary", []) for activity in day.activities
    )
    # The first listed stay and the chosen (else cheapest) way to travel are what the plan counts.
    legs_total = sum(leg.est_inr_per_person for leg in state.get("legs", [])) * request.party_size
    stays = [
        (group[0].price_per_night, dates.nights)
        for group, dates in zip(state["stop_hotels"], state["stop_dates"], strict=True)
        if group
    ]
    cost = estimate_trip_cost(
        stays=stays,
        nights=dates.nights,
        rooms=rooms_for(request.party_size),
        travel_total=(travel.total if travel else 0) + legs_total,
        party_size=request.party_size,
        activities_per_traveler=activities,
        daily_spend_per_traveler=daily_spend_per_traveler(request.travel_style),
        days=request.duration_days,
    )
    # Intercity legs and over-cap flights can push the combined travel and stays over budget.
    if not budget_guessed and not is_within_budget(cost, request.budget):
        question = (
            f"The stay and travel I found come to about ₹{float(cost.stay_and_travel):,.0f}, "
            f"which is over your ₹{request.budget:,} Budget. Could you raise the Budget or "
            "shorten the Trip?"
        )
        return {"clarification": Clarification(missing_fields=["budget"], question=question)}
    return {
        "legs_total": legs_total,
        "cost": cost,
        "travel_options": options,
        "travel_mode": travel.mode if travel else None,
    }


def route_after_budget_check(state: PlanningState) -> str:
    return END if state.get("clarification") else "locate"
