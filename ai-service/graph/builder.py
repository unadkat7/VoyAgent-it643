from collections.abc import Callable
from datetime import date

from langgraph.graph import END, START, StateGraph

from agents.budget_check import budget_check, route_after_budget_check
from agents.check_places import make_check_places_node
from agents.clarify import clarify
from agents.compose import make_compose_node
from agents.fares import make_fares_node
from agents.flights import make_flight_node
from agents.hotels import make_hotel_node
from agents.itinerary import make_itinerary_node
from agents.locate import make_locate_node
from agents.prepare import make_prepare_node
from agents.rail import make_rail_node
from agents.road import make_road_node
from agents.understand import make_understand_node, route_after_understand
from graph.state import PlanningState
from ports.fares import FarePort
from ports.geocoder import GeocoderPort
from ports.llm import LLMPort
from ports.places import PlaceFinderPort
from ports.roads import RouterPort
from ports.search import FlightSearchPort, HotelSearchPort
from ports.timetable import TimetablePort


def route_start(state: PlanningState) -> str:
    """An edited Itinerary only needs costs, pins and prose; a changed request needs searches."""
    if state.get("finish_only"):
        return "budget_check"
    if state.get("request"):
        return "check_places"
    return "understand"


def build_planning_graph(
    *,
    llm: LLMPort,
    hotel_search: HotelSearchPort,
    flight_search: FlightSearchPort,
    geocoder: GeocoderPort,
    today: Callable[[], date],
    timetable: TimetablePort | None = None,
    places: PlaceFinderPort | None = None,
    router: RouterPort | None = None,
    fares: FarePort | None = None,
):
    graph = StateGraph(PlanningState)
    graph.add_node("understand", make_understand_node(llm, today))
    graph.add_node("clarify", clarify)
    graph.add_node("check_places", make_check_places_node(geocoder))
    graph.add_node("prepare", make_prepare_node(today))
    graph.add_node("hotels", make_hotel_node(hotel_search))
    graph.add_node("flights", make_flight_node(flight_search))
    graph.add_node("itinerary", make_itinerary_node(llm))
    graph.add_node("budget_check", budget_check)
    graph.add_node("locate", make_locate_node(geocoder))
    graph.add_node("compose", make_compose_node(llm))

    searches = ["hotels", "flights", "itinerary"]
    # Trains and roads need a place finder; each runs only when its Provider is plugged in.
    if places is not None and timetable is not None:
        graph.add_node("rail", make_rail_node(timetable, places, router))
        searches.append("rail")
    if places is not None and router is not None:
        graph.add_node("road", make_road_node(places, router))
        searches.append("road")
    if fares is not None:
        graph.add_node("fares", make_fares_node(fares))
        searches.append("fares")

    # A new Conversation starts at understand; a plan edit starts later (see route_start).
    graph.add_conditional_edges(START, route_start, ["understand", "check_places", "budget_check"])
    graph.add_conditional_edges("understand", route_after_understand, ["clarify", "check_places"])
    graph.add_conditional_edges(
        "check_places",
        lambda state: END if state.get("clarification") else "prepare",
        [END, "prepare"],
    )
    graph.add_edge("clarify", END)

    # Fan out to the independent searches, then join before checking the Budget.
    for step in searches:
        graph.add_edge("prepare", step)
    graph.add_edge(searches, "budget_check")
    graph.add_conditional_edges("budget_check", route_after_budget_check, ["locate", END])
    graph.add_edge("locate", "compose")
    graph.add_edge("compose", END)

    return graph.compile()
