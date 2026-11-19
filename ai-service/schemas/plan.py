from typing import Literal

from pydantic import BaseModel, Field

from schemas.geo import GeoPoint
from schemas.itinerary import ItineraryDay
from schemas.recommendations import FlightRecommendation, HotelRecommendation
from schemas.trip_request import TripRequest


class TripSummary(BaseModel):
    """The only part of a plan the LLM writes at the end: prose, never prices."""

    summary: str
    important_tips: list[str] = Field(default_factory=list)


class EstimatedCost(BaseModel):
    hotel_total: float
    flight_total: float
    total: float
    currency: Literal["INR"] = "INR"


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
