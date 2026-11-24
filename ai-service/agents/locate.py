from collections.abc import Callable

from graph.state import PlanningState
from ports.geocoder import GeocodeError, GeocoderPort
from ports.place_details import PlaceDetailsError, PlaceDetailsPort
from schemas.geo import GeoPoint, Region
from schemas.itinerary import ItineraryDay
from schemas.recommendations import HotelRecommendation

# Nominatim allows one request a second, so this bounds the extra planning time.
MAX_LOOKUPS = 20
# Place details use the small SerpAPI plan (250 a month), so only a few Activities per Trip.
MAX_PLACE_DETAILS = 5
# Pins farther than this from a city's centre are namesakes elsewhere; bigger areas use their size.
MIN_REGION_KM = 120.0
OUTAGE_NOTE = "Places could not be found on the map right now, so the Trip Map may be empty."


class _Lookups:
    """Asks the geocoder at most MAX_LOOKUPS distinct questions and stops after an outage."""

    def __init__(self, geocoder: GeocoderPort, destination: str, limit: int):
        self._limit = limit
        self._geocoder = geocoder
        self._destination = destination
        self._region: Region | None = None
        self._answers: dict[str, GeoPoint | None] = {}
        self.failed = False

    def is_destination(self, place: str) -> bool:
        # A pin on the city centre would pretend to be the Hotel's exact spot.
        return place.strip().lower() == self._destination.lower()

    def locate_destination(self) -> GeoPoint | None:
        def lookup() -> GeoPoint | None:
            area = self._geocoder.locate_area(self._destination)
            if area is None:
                return None
            radius = max(MIN_REGION_KM, area.radius_km)
            self._region = Region(center=area.center, radius_km=radius)
            return area.center

        return self._remember(self._destination, lookup)

    def near_destination(self, place: str) -> GeoPoint | None:
        place = place.strip()
        if not place:
            return None
        point = self._ask(self._with_destination(place))
        # Nominatim misses names with extra qualifiers ("Palolem Beach, South Goa"); retry the name.
        name = place.split(",")[0].strip()
        if point is None and name and name != place:
            point = self._ask(self._with_destination(name))
        return point

    @property
    def region(self) -> Region | None:
        return self._region

    def query_for(self, place: str) -> str:
        return self._with_destination(place.strip())

    def within(self, point: GeoPoint | None) -> bool:
        # A hit far outside the Destination is a namesake in another place.
        return point is None or self._region is None or self._region.contains(point)

    def _with_destination(self, place: str) -> str:
        if self._destination.lower() in place.lower():
            return place
        return f"{place}, {self._destination}"

    def _ask(self, query: str) -> GeoPoint | None:
        def lookup() -> GeoPoint | None:
            point = self._geocoder.locate(query, near=self._region)
            return point if self.within(point) else None

        return self._remember(query, lookup)

    def _remember(self, query: str, lookup: Callable[[], GeoPoint | None]) -> GeoPoint | None:
        if query in self._answers:
            return self._answers[query]
        if self.failed or len(self._answers) >= self._limit:
            return None
        try:
            point = lookup()
        except GeocodeError:
            self.failed = True
            point = None
        self._answers[query] = point
        return point


def make_locate_node(
    geocoder: GeocoderPort,
    place_details: PlaceDetailsPort | None = None,
    max_details: int = MAX_PLACE_DETAILS,
):
    def locate(state: PlanningState) -> PlanningState:
        cities = [s.city for s in state.get("route", [])] or [state["request"].destination]
        lookups = [_Lookups(geocoder, city, max(4, MAX_LOOKUPS // len(cities))) for city in cities]
        points = [lookup.locate_destination() for lookup in lookups]
        groups = state.get("stop_hotels", [state.get("hotels", [])])
        hotels = [
            [_locate_hotel(h, lookup) for h in group]
            for lookup, group in zip(lookups, groups, strict=True)
        ]

        def lookups_for(day: ItineraryDay) -> _Lookups:
            return lookups[day.stop if day.stop is not None and day.stop < len(cities) else 0]

        itinerary = [_locate_day(day, lookups_for(day)) for day in state.get("itinerary", [])]
        if place_details is not None and max_details > 0:
            itinerary = _add_place_details(itinerary, lookups_for, place_details, max_details)
        update: PlanningState = {
            "destination_point": points[0],
            "stop_points": points,
            "hotels": hotels[0],
            "stop_hotels": hotels,
            "itinerary": itinerary,
        }
        if any(lookup.failed for lookup in lookups):
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


def _add_place_details(
    itinerary: list[ItineraryDay],
    lookups_for: Callable[[ItineraryDay], _Lookups],
    place_details: PlaceDetailsPort,
    limit: int,
) -> list[ItineraryDay]:
    """Real ratings, photos and pins for a few Activities; the paid quota is small."""
    days = [day.model_copy(update={"activities": list(day.activities)}) for day in itinerary]
    candidates = [
        (d, a)
        for d, day in enumerate(days)
        for a, activity in enumerate(day.activities)
        if activity.maps_url is None
        and activity.location.strip()
        and not lookups_for(day).is_destination(activity.location)
    ]
    # Unpinned Activities first: the free geocoders already placed the others.
    candidates.sort(key=lambda c: days[c[0]].activities[c[1]].coordinates is not None)
    asked: set[str] = set()
    for d, a in candidates:
        lookups = lookups_for(days[d])
        query = lookups.query_for(days[d].activities[a].location)
        if query not in asked and len(asked) >= limit:
            continue
        asked.add(query)
        try:
            details = place_details.lookup(query, near=lookups.region)
        except PlaceDetailsError:
            break  # A paused quota stays paused for the rest of this Trip.
        if details is None or not lookups.within(details.point):
            continue
        activity = days[d].activities[a]
        days[d].activities[a] = activity.model_copy(
            update={
                "coordinates": activity.coordinates or details.point,
                "rating": details.rating,
                "image_url": details.image_url,
                "maps_url": details.maps_url,
            }
        )
    return days
