from collections.abc import Callable
from datetime import date

from langgraph.graph import END, START, StateGraph

from agents.budget_check import budget_check, route_after_budget_check
from agents.clarify import clarify
from agents.compose import make_compose_node
from agents.flights import make_flight_node
from agents.hotels import make_hotel_node
from agents.itinerary import make_itinerary_node
from agents.prepare import make_prepare_node
from agents.understand import make_understand_node, route_after_understand
from graph.state import PlanningState
from ports.llm import LLMPort
from ports.search import FlightSearchPort, HotelSearchPort


def build_planning_graph(
    *,
    llm: LLMPort,
    hotel_search: HotelSearchPort,
    flight_search: FlightSearchPort,
    today: Callable[[], date],
):
    graph = StateGraph(PlanningState)
    graph.add_node("understand", make_understand_node(llm, today))
    graph.add_node("clarify", clarify)
    graph.add_node("prepare", make_prepare_node(today))
    graph.add_node("hotels", make_hotel_node(hotel_search))
    graph.add_node("flights", make_flight_node(flight_search))
    graph.add_node("itinerary", make_itinerary_node(llm))
    graph.add_node("budget_check", budget_check)
    graph.add_node("compose", make_compose_node(llm))

    graph.add_edge(START, "understand")
    graph.add_conditional_edges("understand", route_after_understand, ["clarify", "prepare"])
    graph.add_edge("clarify", END)

    # Fan out to the three independent searches, then join before checking the Budget.
    for step in ("hotels", "flights", "itinerary"):
        graph.add_edge("prepare", step)
    graph.add_edge(["hotels", "flights", "itinerary"], "budget_check")
    graph.add_conditional_edges("budget_check", route_after_budget_check, ["compose", END])
    graph.add_edge("compose", END)

    return graph.compile()
