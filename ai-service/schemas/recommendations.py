from typing import Literal

from pydantic import BaseModel, Field
from pydantic.json_schema import SkipJsonSchema

from domain.money import CurrencyCode
from schemas.geo import GeoPoint

# "live" came from a Provider search; "estimated" was produced by the LLM (an Estimated Cost).
PriceSource = Literal["live", "estimated"]


class HotelRecommendation(BaseModel):
    name: str
    location: str
    price_per_night: float = Field(ge=0)
    currency: CurrencyCode = "INR"
    rating: float | None = None
    hotel_class: str | None = None
    booking_url: str | None = None
    image_url: str | None = None
    amenities: list[str] = Field(default_factory=list)
    price_source: PriceSource = "estimated"
    # Set from live Provider GPS or the locate step; hidden from the LLM's schema.
    coordinates: SkipJsonSchema[GeoPoint | None] = None


class FlightRecommendation(BaseModel):
    airline: str
    direction: SkipJsonSchema[Literal["outbound", "return"] | None] = None
    flight_number: str | None = None
    departure_airport: str
    arrival_airport: str
    departure_time: str | None = None
    arrival_time: str | None = None
    duration: str | None = None
    price_per_traveler: float = Field(
        ge=0, description="Fare for the requested journey for one Traveler in the Trip currency"
    )
    currency: CurrencyCode = "INR"
    stops: int = Field(0, ge=0)
    price_source: PriceSource = "estimated"
    # Set by the planner when the fare is over the flight share of the Budget; hidden from the LLM.
    over_budget: SkipJsonSchema[bool] = False


class HotelRecommendations(BaseModel):
    hotels: list[HotelRecommendation]


class FlightRecommendations(BaseModel):
    flights: list[FlightRecommendation]
