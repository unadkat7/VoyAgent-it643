from typing import Literal

from pydantic import BaseModel, Field

# "live" came from a Provider search; "estimated" was produced by the LLM (an Estimated Cost).
PriceSource = Literal["live", "estimated"]


class HotelRecommendation(BaseModel):
    name: str
    location: str
    price_per_night: float = Field(ge=0)
    currency: Literal["INR"] = "INR"
    rating: float | None = None
    hotel_class: str | None = None
    booking_url: str | None = None
    image_url: str | None = None
    amenities: list[str] = Field(default_factory=list)
    price_source: PriceSource = "estimated"


class FlightRecommendation(BaseModel):
    airline: str
    flight_number: str | None = None
    departure_airport: str
    arrival_airport: str
    departure_time: str | None = None
    arrival_time: str | None = None
    duration: str | None = None
    price_per_traveler: float = Field(ge=0, description="Round-trip fare for one Traveler in INR")
    currency: Literal["INR"] = "INR"
    stops: int = Field(0, ge=0)
    price_source: PriceSource = "estimated"


class HotelRecommendations(BaseModel):
    hotels: list[HotelRecommendation]


class FlightRecommendations(BaseModel):
    flights: list[FlightRecommendation]
