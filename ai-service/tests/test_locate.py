import json

from agents.locate import MAX_LOOKUPS, make_locate_node
from ports.geocoder import GeocodeError
from ports.place_details import PlaceDetails, PlaceDetailsError
from schemas.geo import GeoPoint, Region
from schemas.itinerary import Activity, Itinerary, ItineraryDay
from schemas.recommendations import HotelRecommendation, HotelRecommendations
from schemas.trip_request import TripRequest
from tests.fakes import FakeGeocoder

GOA = GeoPoint(lat=15.3, lng=74.1)
BAGA = GeoPoint(lat=15.55, lng=73.75)
FORT = GeoPoint(lat=15.5, lng=73.77)
SEA_VIEW = GeoPoint(lat=15.6, lng=73.74)
INVENTED = GeoPoint(lat=0, lng=0)
REQUEST = TripRequest(destination="Goa")


def activity(location, coordinates=None):
    return Activity(
        time="Morning", title=location, description="", location=location, coordinates=coordinates
    )


def day(number, *activities):
    return ItineraryDay(day=number, title=f"Day {number}", activities=list(activities))


def stay(name, location="Goa", source="estimated", coordinates=None):
    return HotelRecommendation(
        name=name,
        location=location,
        price_per_night=3000,
        price_source=source,
        coordinates=coordinates,
    )


def run(geocoder, hotels=(), itinerary=()):
    node = make_locate_node(geocoder)
    return node({"request": REQUEST, "hotels": list(hotels), "itinerary": list(itinerary)})


def test_destination_hotels_and_activities_get_coordinates():
    geocoder = FakeGeocoder(
        {"Goa": GOA, "Sea View, Goa": SEA_VIEW, "Baga Beach, Goa": BAGA, "Fort Aguada, Goa": FORT}
    )

    result = run(
        geocoder,
        hotels=[stay("Sea View")],
        itinerary=[day(1, activity("Baga Beach")), day(2, activity("Fort Aguada"))],
    )

    assert result["destination_point"] == GOA
    assert result["hotels"][0].coordinates == SEA_VIEW
    assert [d.activities[0].coordinates for d in result["itinerary"]] == [BAGA, FORT]


def test_hotel_falls_back_to_its_area_when_its_name_is_unknown():
    geocoder = FakeGeocoder({"Calangute, Goa": BAGA})

    result = run(geocoder, hotels=[stay("Made Up Inn", location="Calangute")])

    assert result["hotels"][0].coordinates == BAGA


def test_place_with_a_region_qualifier_is_retried_by_its_name_only():
    palolem = GeoPoint(lat=15.01, lng=74.02)
    geocoder = FakeGeocoder({"Palolem Beach, Goa": palolem})

    result = run(geocoder, itinerary=[day(1, activity("Palolem Beach, South Goa"))])

    assert result["itinerary"][0].activities[0].coordinates == palolem
    assert geocoder.queries == ["Goa", "Palolem Beach, South Goa", "Palolem Beach, Goa"]


def test_live_hotel_coordinates_are_kept_and_not_looked_up():
    geocoder = FakeGeocoder({"Goa": GOA})

    result = run(geocoder, hotels=[stay("Sea View", source="live", coordinates=SEA_VIEW)])

    assert result["hotels"][0].coordinates == SEA_VIEW
    assert geocoder.queries == ["Goa"]


def test_llm_written_coordinates_are_replaced():
    geocoder = FakeGeocoder({"Baga Beach, Goa": BAGA})

    result = run(
        geocoder,
        hotels=[stay("Ghost Hotel", coordinates=INVENTED)],
        itinerary=[day(1, activity("Baga Beach", INVENTED), activity("Nowhere", INVENTED))],
    )

    assert result["hotels"][0].coordinates is None
    assert [a.coordinates for a in result["itinerary"][0].activities] == [BAGA, None]


def test_llm_is_never_asked_for_coordinates():
    assert "coordinates" not in json.dumps(Itinerary.model_json_schema())
    assert "coordinates" not in json.dumps(HotelRecommendations.model_json_schema())


def test_same_place_is_looked_up_once_and_destination_is_not_repeated():
    geocoder = FakeGeocoder({"Baga Beach, Goa": BAGA})

    run(geocoder, itinerary=[day(1, activity("Baga Beach"), activity("Baga Beach, Goa"))])

    assert geocoder.queries == ["Goa", "Baga Beach, Goa"]


def test_lookups_are_capped():
    activities = [activity(f"Place {n}") for n in range(MAX_LOOKUPS + 5)]
    geocoder = FakeGeocoder()

    result = run(geocoder, itinerary=[day(1, *activities)])

    assert len(geocoder.queries) == MAX_LOOKUPS
    assert all(a.coordinates is None for a in result["itinerary"][0].activities)


def test_geocoder_outage_stops_lookups_and_leaves_a_note():
    geocoder = FakeGeocoder(error=GeocodeError("down"))

    result = run(geocoder, itinerary=[day(1, activity("Baga Beach"), activity("Fort Aguada"))])

    assert geocoder.queries == ["Goa"]
    assert result["destination_point"] is None
    assert all(a.coordinates is None for a in result["itinerary"][0].activities)
    assert any("map" in note.lower() for note in result["notes"])


def test_out_of_region_pin_far_from_destination_is_discarded():
    wrong_state = GeoPoint(lat=28.61, lng=77.21)
    geocoder = FakeGeocoder({"Goa": GOA, "Baga Beach, Goa": wrong_state})

    result = run(geocoder, itinerary=[day(1, activity("Baga Beach"))])

    assert result["itinerary"][0].activities[0].coordinates is None


def test_out_of_region_hotel_pin_is_discarded():
    wrong_state = GeoPoint(lat=28.61, lng=77.21)
    geocoder = FakeGeocoder({"Goa": GOA, "Sea View, Goa": wrong_state})

    result = run(geocoder, hotels=[stay("Sea View")])

    assert result["hotels"][0].coordinates is None


def test_large_destination_keeps_pins_across_its_whole_area():
    rajasthan = Region(center=GeoPoint(lat=26.81, lng=73.77), radius_km=600)
    amber_fort = GeoPoint(lat=26.99, lng=75.85)
    geocoder = FakeGeocoder({"Rajasthan": rajasthan, "Amber Fort, Rajasthan": amber_fort})
    node = make_locate_node(geocoder)

    result = node(
        {
            "request": TripRequest(destination="Rajasthan"),
            "itinerary": [day(1, activity("Amber Fort"))],
        }
    )

    assert result["destination_point"] == rajasthan.center
    assert result["itinerary"][0].activities[0].coordinates == amber_fort


class FakePlaceDetails:
    def __init__(self, places: dict | None = None, error: bool = False):
        self._places = places or {}
        self._error = error
        self.queries: list[str] = []

    def lookup(self, query, near=None):
        self.queries.append(query)
        if self._error:
            raise PlaceDetailsError("SerpAPI places paused")
        return self._places.get(query)


def details(point=None, rating=4.5):
    return PlaceDetails(
        point=point, rating=rating, image_url="https://img/x.jpg", maps_url="https://maps/x"
    )


def run_with_details(geocoder, place_details, itinerary, limit=5):
    node = make_locate_node(geocoder, place_details, limit)
    return node({"request": REQUEST, "itinerary": list(itinerary)})


def test_place_details_fill_missing_pins_and_add_ratings_photos_and_links():
    geocoder = FakeGeocoder({"Goa": GOA, "Baga Beach, Goa": BAGA})
    places = FakePlaceDetails(
        {"Fort Aguada, Goa": details(FORT), "Baga Beach, Goa": details(SEA_VIEW, rating=4.1)}
    )

    result = run_with_details(
        geocoder, places, [day(1, activity("Baga Beach"), activity("Fort Aguada"))]
    )

    baga, fort = result["itinerary"][0].activities
    assert fort.coordinates == FORT
    assert (fort.rating, fort.image_url, fort.maps_url) == (
        4.5,
        "https://img/x.jpg",
        "https://maps/x",
    )
    # The free geocoder's pin is kept; only the rating and photo are added.
    assert baga.coordinates == BAGA
    assert baga.rating == 4.1


def test_place_details_are_capped_per_trip_and_unpinned_activities_go_first():
    geocoder = FakeGeocoder({"Goa": GOA, "Place 0, Goa": BAGA})
    places = FakePlaceDetails()
    activities = [activity(f"Place {n}") for n in range(4)]

    run_with_details(geocoder, places, [day(1, *activities)], limit=2)

    assert places.queries == ["Place 1, Goa", "Place 2, Goa"]


def test_destination_itself_and_already_detailed_activities_are_skipped():
    geocoder = FakeGeocoder({"Goa": GOA})
    places = FakePlaceDetails()
    done = activity("Fort Aguada").model_copy(update={"maps_url": "https://maps/fort"})

    run_with_details(geocoder, places, [day(1, activity("Goa"), done)])

    assert places.queries == []


def test_far_away_namesake_details_are_dropped():
    geocoder = FakeGeocoder({"Goa": GOA})
    delhi = GeoPoint(lat=28.61, lng=77.21)
    places = FakePlaceDetails({"Fort Aguada, Goa": details(delhi)})

    result = run_with_details(geocoder, places, [day(1, activity("Fort Aguada"))])

    fort = result["itinerary"][0].activities[0]
    assert fort.coordinates is None
    assert fort.rating is None


def test_paused_place_details_stop_quietly_and_keep_free_pins():
    geocoder = FakeGeocoder({"Goa": GOA, "Baga Beach, Goa": BAGA})
    places = FakePlaceDetails(error=True)

    result = run_with_details(
        geocoder, places, [day(1, activity("Fort Aguada"), activity("Baga Beach"))]
    )

    assert len(places.queries) == 1
    fort, baga = result["itinerary"][0].activities
    assert baga.coordinates == BAGA
    assert fort.rating is None
    assert "notes" not in result


def test_llm_is_never_asked_for_ratings_photos_or_links():
    schema = json.dumps(Itinerary.model_json_schema())
    assert all(field not in schema for field in ("rating", "image_url", "maps_url"))
