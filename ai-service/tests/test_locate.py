import json

from agents.locate import MAX_LOOKUPS, make_locate_node
from ports.geocoder import GeocodeError
from schemas.geo import GeoPoint
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


def test_destination_hotels_and_activities_get_locations():
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
