import operator
from typing import Annotated, TypedDict

from domain.budget import BudgetCaps
from domain.dates import TripDates
from domain.feasibility import TripCost
from schemas.api import Clarification, ConversationTurn
from schemas.itinerary import ItineraryDay
from schemas.plan import TripPlan
from schemas.recommendations import FlightRecommendation, HotelRecommendation
from schemas.trip_request import TripRequest


class PlanningState(TypedDict, total=False):
    conversation: list[ConversationTurn]
    request: TripRequest
    missing_fields: list[str]
    dates: TripDates
    caps: BudgetCaps
    hotels: list[HotelRecommendation]
    hotels_over_budget: bool
    cheapest_hotel_price: float
    flights: list[FlightRecommendation]
    itinerary: list[ItineraryDay]
    # Hotel, flight and itinerary nodes run in parallel and may each add notes.
    notes: Annotated[list[str], operator.add]
    cost: TripCost
    clarification: Clarification
    plan: TripPlan
