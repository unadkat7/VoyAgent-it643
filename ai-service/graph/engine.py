from collections.abc import Callable
from datetime import date

from graph.builder import build_planning_graph
from ports.geocoder import GeocoderPort
from ports.llm import LLMPort
from ports.places import PlaceFinderPort
from ports.roads import RouterPort
from ports.search import FlightSearchPort, HotelSearchPort
from ports.timetable import TimetablePort
from schemas.api import PlanTripRequest, PlanTripResponse


class PlanningEngine:
    """Turns a Traveler's Conversation into a Clarification or a Trip plan. Stateless per call."""

    def __init__(
        self,
        *,
        llm: LLMPort,
        hotel_search: HotelSearchPort,
        flight_search: FlightSearchPort,
        geocoder: GeocoderPort,
        today: Callable[[], date] = date.today,
        timetable: TimetablePort | None = None,
        places: PlaceFinderPort | None = None,
        router: RouterPort | None = None,
    ):
        self._graph = build_planning_graph(
            llm=llm,
            hotel_search=hotel_search,
            flight_search=flight_search,
            geocoder=geocoder,
            today=today,
            timetable=timetable,
            places=places,
            router=router,
        )

    def plan(self, request: PlanTripRequest) -> PlanTripResponse:
        state = self._graph.invoke({"conversation": request.conversation, "notes": []})
        if clarification := state.get("clarification"):
            return PlanTripResponse(
                status="needs_clarification", trip_id=request.trip_id, clarification=clarification
            )
        return PlanTripResponse(status="planned", trip_id=request.trip_id, plan=state["plan"])
