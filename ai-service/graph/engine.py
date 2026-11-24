from collections.abc import Callable
from datetime import date

from agents.locate import MAX_PLACE_DETAILS
from graph.builder import build_planning_graph
from graph.editor import PlanEditor
from ports.fares import FarePort
from ports.geocoder import GeocoderPort
from ports.llm import LLMPort
from ports.place_details import PlaceDetailsPort
from ports.places import PlaceFinderPort
from ports.roads import RouterPort
from ports.search import FlightSearchPort, HotelSearchPort
from ports.timetable import TimetablePort
from schemas.api import EditPlanRequest, EditPlanResponse, PlanTripRequest, PlanTripResponse


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
        fares: FarePort | None = None,
        place_details: PlaceDetailsPort | None = None,
        place_details_per_trip: int = MAX_PLACE_DETAILS,
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
            fares=fares,
            place_details=place_details,
            place_details_per_trip=place_details_per_trip,
        )
        self._editor = PlanEditor(llm=llm, graph=self._graph, today=today)

    def plan(self, request: PlanTripRequest) -> PlanTripResponse:
        state = self._graph.invoke({"conversation": request.conversation, "notes": []})
        if clarification := state.get("clarification"):
            return PlanTripResponse(
                status="needs_clarification", trip_id=request.trip_id, clarification=clarification
            )
        return PlanTripResponse(status="planned", trip_id=request.trip_id, plan=state["plan"])

    def edit(self, request: EditPlanRequest) -> EditPlanResponse:
        """One chat message about a finished plan: an answer, edited days, or a re-plan."""
        return self._editor.edit(request)
