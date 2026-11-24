from typing import Literal

from pydantic import BaseModel, Field

from schemas.geo import GeoPoint
from schemas.itinerary import ItineraryDay
from schemas.recommendations import FlightRecommendation, HotelRecommendation
from schemas.route import RouteStop, StopLeg
from schemas.travel import RoadRoute, TrainOption, TravelMode, TravelOption
from schemas.trip_request import TripRequest


class TripSummary(BaseModel):
    """The only part of a plan the LLM writes at the end: prose, never prices."""

    summary: str
    important_tips: list[str] = Field(default_factory=list)


class EstimatedCost(BaseModel):
    hotel_total: float
    total: float
    currency: Literal["INR"] = "INR"
    # The chosen way to get there and back; plans saved before this only had flight_total.
    legs_total: float = 0
    travel_total: float = 0
    travel_mode: TravelMode | None = None
    # Defaults keep plans saved before these were added readable.
    activities_total: float = 0
    daily_spend_total: float = 0
    rooms: int = 1
    per_person: float = 0


class Stop(RouteStop):
    check_in: str
    check_out: str
    nights: int
    hotels: list[HotelRecommendation] = Field(default_factory=list)
    coordinates: GeoPoint | None = None


class TripPlan(BaseModel):
    summary: str
    important_tips: list[str]
    request: TripRequest
    check_in: str
    check_out: str
    nights: int
    hotels: list[HotelRecommendation]
    flights: list[FlightRecommendation]
    itinerary: list[ItineraryDay]
    estimated_cost: EstimatedCost
    notes: list[str] = Field(default_factory=list)
    destination_coordinates: GeoPoint | None = None
    # Getting there by train and by road. Empty for plans made before these were added.
    trains_out: list[TrainOption] = Field(default_factory=list)
    trains_back: list[TrainOption] = Field(default_factory=list)
    road_route: RoadRoute | None = None
    road_leg: RoadRoute | None = None
    timetable_as_of: str | None = None
    # Every priced way to get there and back; estimated_cost.travel_mode says which is counted.
    travel_options: list[TravelOption] = Field(default_factory=list)
    # What the plan guessed because the Traveler didn't say, and the question to refine it.
    assumed_fields: list[str] = Field(default_factory=list)
    assumptions: list[str] = Field(default_factory=list)
    follow_up: str | None = None
    stops: list[Stop] = Field(default_factory=list)
    legs: list[StopLeg] = Field(default_factory=list)
