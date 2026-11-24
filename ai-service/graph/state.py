import operator
from typing import Annotated, TypedDict

from domain.budget import BudgetCaps
from domain.dates import TripDates
from domain.feasibility import TripCost
from schemas.api import Clarification, ConversationTurn
from schemas.geo import GeoPoint
from schemas.itinerary import ItineraryDay
from schemas.plan import TripPlan
from schemas.recommendations import FlightRecommendation, HotelRecommendation
from schemas.travel import RoadRoute, TrainOption, TravelFares, TravelOption
from schemas.trip_request import TripRequest


class PlanningState(TypedDict, total=False):
    conversation: list[ConversationTurn]
    # Set by a plan edit that changed only the Itinerary: skip straight to costs.
    finish_only: bool
    request: TripRequest
    missing_fields: list[str]
    # Fields the Traveler left out that the plan guessed (or, for Origin, left empty).
    assumed_fields: list[str]
    dates: TripDates
    caps: BudgetCaps
    hotels: list[HotelRecommendation]
    hotels_over_budget: bool
    cheapest_hotel_price: float
    # Cheapest stays found when none fit the caps; used only when the Budget was guessed.
    hotels_over_cap: list[HotelRecommendation]
    flights: list[FlightRecommendation]
    itinerary: list[ItineraryDay]
    # Hotel, flight and itinerary nodes run in parallel and may each add notes.
    notes: Annotated[list[str], operator.add]
    cost: TripCost
    fares: TravelFares
    # Built by the budget step, or carried over from the plan when only the Itinerary is edited.
    travel_options: list[TravelOption]
    # The travel option the Traveler picked; the cheapest is counted when unset.
    travel_mode: str | None
    trains_out: list[TrainOption]
    trains_back: list[TrainOption]
    road_route: RoadRoute
    road_leg: RoadRoute
    timetable_as_of: str
    destination_point: GeoPoint | None
    clarification: Clarification
    plan: TripPlan
