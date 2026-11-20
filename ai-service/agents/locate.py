from graph.state import PlanningState
from ports.geocoder import GeocodeError, GeocoderPort
from schemas.geo import GeoPoint
from schemas.itinerary import ItineraryDay
from schemas.recommendations import HotelRecommendation

# Nominatim allows one request a second, so this bounds the extra planning time.
MAX_LOOKUPS = 20
OUTAGE_NOTE = "Places could not be found on the map right now, so the Trip Map may be empty."


class _Lookups:
    """Asks the geocoder at most MAX_LOOKUPS distinct questions and stops after an outage."""

    def __init__(self, geocoder: GeocoderPort, destination: str):
        self._geocoder = geocoder
        self._destination = destination
        self._answers: dict[str, GeoPoint | None] = {}
        self.failed = False

    def is_destination(self, place: str) -> bool:
        # A pin on the city centre would pretend to be the Hotel's exact spot.
        return place.strip().lower() == self._destination.lower()

    def near_destination(self, place: str) -> GeoPoint | None:
        place = place.strip()
        if not place:
            return None
        if self._destination.lower() in place.lower():
            return self.ask(place)
        return self.ask(f"{place}, {self._destination}")

    def ask(self, query: str) -> GeoPoint | None:
        if query in self._answers:
            return self._answers[query]
        if self.failed or len(self._answers) >= MAX_LOOKUPS:
            return None
        try:
            point = self._geocoder.locate(query)
        except GeocodeError:
            self.failed = True
            point = None
        self._answers[query] = point
        return point


def make_locate_node(geocoder: GeocoderPort):
    def locate(state: PlanningState) -> PlanningState:
        lookups = _Lookups(geocoder, state["request"].destination)
        destination_point = lookups.ask(state["request"].destination)
        hotels = [_locate_hotel(hotel, lookups) for hotel in state.get("hotels", [])]
        itinerary = [_locate_day(day, lookups) for day in state.get("itinerary", [])]
        update: PlanningState = {
            "destination_point": destination_point,
            "hotels": hotels,
            "itinerary": itinerary,
        }
        if lookups.failed:
            update["notes"] = [OUTAGE_NOTE]
        return update

    return locate


def _locate_hotel(hotel: HotelRecommendation, lookups: _Lookups) -> HotelRecommendation:
    # Live Provider coordinates are trusted; anything else may have been written by the LLM.
    if hotel.price_source == "live" and hotel.coordinates:
        return hotel
    point = lookups.near_destination(hotel.name)
    if point is None and not lookups.is_destination(hotel.location):
        point = lookups.near_destination(hotel.location)
    return hotel.model_copy(update={"coordinates": point})


def _locate_day(day: ItineraryDay, lookups: _Lookups) -> ItineraryDay:
    activities = [
        activity.model_copy(update={"coordinates": lookups.near_destination(activity.location)})
        for activity in day.activities
    ]
    return day.model_copy(update={"activities": activities})
