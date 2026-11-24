"""Trains and road routes in a planned Trip, driven through the whole Planning Engine with fakes."""

from datetime import date

from adapters.no_geocoder import NoGeocoder
from domain.places import PlaceMatch
from domain.roads import Drive
from domain.timetable import Station, Stop, Timetable, Train
from graph.engine import PlanningEngine
from ports.geocoder import GeocodeError
from ports.roads import RouteError
from ports.timetable import TimetableError
from schemas.api import ConversationTurn, PlanTripRequest
from schemas.geo import GeoPoint
from schemas.itinerary import Activity, Itinerary, ItineraryDay
from schemas.plan import TripSummary
from schemas.recommendations import HotelRecommendation
from schemas.trip_request import TripRequest
from tests.fakes import FakeLLM, FakePlaces, FakeRouter, FakeTimetable, SequenceSearch

TODAY = date(2026, 11, 24)
SURAT = GeoPoint(lat=21.209, lng=72.832)
HARIDWAR = GeoPoint(lat=29.938, lng=78.145)
BADRINATH = GeoPoint(lat=30.742, lng=79.493)
STATION_POINTS = {
    "ST": ("SURAT", 21.2064, 72.8406),
    "HW": ("HARIDWAR JN", 29.9481, 78.1552),
    "RKSH": ("RISHIKESH", 30.1075, 78.2878),
}


def minutes(clock):
    hours, mins = clock.split(":")
    return int(hours) * 60 + int(mins)


def train(number, name, stops, days=range(7)):
    return Train(
        number=number,
        name=name,
        weekdays=frozenset(days),
        first_day=date(2026, 1, 1),
        last_day=date(2027, 8, 30),
        stops=tuple(Stop(station=s, arrive=minutes(a), depart=minutes(d)) for s, a, d in stops),
    )


def make_timetable():
    stations = {
        code: Station(code=code, name=name, point=GeoPoint(lat=lat, lng=lng))
        for code, (name, lat, lng) in STATION_POINTS.items()
    }
    trains = [
        train(
            "12911", "BL HARIDWAR EXP", [("ST", "16:10", "16:15"), ("HW", "38:30", "38:30")], [1]
        ),
        # Runs only on Tuesdays: the day after check-out (Monday 21 December).
        train("12912", "HW BL EXP", [("HW", "06:00", "06:00"), ("ST", "28:00", "28:00")], [1]),
        # Leaves Haridwar early on check-out morning, while the Traveler is still at Badrinath.
        train("22660", "YNRK TVCN EXP", [("HW", "07:45", "07:45"), ("ST", "27:00", "27:00")], [0]),
        # 25 hours to Rishikesh: arrives first only because it leaves a day earlier.
        train("19031", "YOGA EXP", [("ST", "02:00", "02:00"), ("RKSH", "27:00", "27:00")], [0]),
        # Ten local trains a day keep Haridwar and Rishikesh busy enough to be railheads.
        *(
            train(
                f"5448{n}",
                "HW RKSH PASS",
                [("HW", f"{8 + n}:00", f"{8 + n}:00"), ("RKSH", f"{9 + n}:05", f"{9 + n}:05")],
            )
            for n in range(10)
        ),
    ]
    return Timetable(as_of="2026-08-30", stations=stations, trains=tuple(trains))


def place(name, point, kind="city", importance=0.6):
    return PlaceMatch(name=name, point=point, radius_km=0, importance=importance, kind=kind)


PLACES = {
    "Surat": [place("Surat", SURAT)],
    "Rishikesh": [place("Rishikesh", GeoPoint(lat=30.109, lng=78.292), kind="town")],
    "Haridwar": [place("Haridwar", HARIDWAR)],
    "Badrinath": [place("Badrinath", BADRINATH, kind="town", importance=0.16)],
}
HW_POINT = make_timetable().stations["HW"].point
RKSH_POINT = make_timetable().stations["RKSH"].point
DRIVES = {
    (HW_POINT.lat, HW_POINT.lng, BADRINATH.lat, BADRINATH.lng): Drive(km=319, hours=7.8),
    (RKSH_POINT.lat, RKSH_POINT.lng, BADRINATH.lat, BADRINATH.lng): Drive(km=294, hours=7.3),
}


def request_to(destination, origin="Surat"):
    return TripRequest(
        origin=origin,
        destination=destination,
        duration_days=5,
        budget=40_000,
        party_size=2,
        travel_style="spiritual",
        start_date="2026-12-16",
    )


def make_engine(destination, *, origin="Surat", timetable=None, places=None, router=None):
    llm = FakeLLM(
        {
            TripRequest: request_to(destination, origin),
            Itinerary: Itinerary(
                days=[
                    ItineraryDay(
                        day=1,
                        title="Temple",
                        activities=[
                            Activity(
                                time="Morning",
                                title="Darshan",
                                description="",
                                location=destination,
                            )
                        ],
                    )
                ]
            ),
            TripSummary: TripSummary(summary="A calm trip.", important_tips=[]),
        }
    )
    stay = HotelRecommendation(
        name="Guest House", location=destination, price_per_night=1_500, rating=4
    )
    return PlanningEngine(
        llm=llm,
        hotel_search=SequenceSearch([stay]),
        flight_search=SequenceSearch([]),  # only Dubai has an airport; no flights are found
        geocoder=NoGeocoder(),
        today=lambda: TODAY,
        timetable=timetable or FakeTimetable(make_timetable()),
        places=places or FakePlaces(PLACES),
        router=router or FakeRouter(DRIVES, default=Drive(km=1350, hours=22.0)),
    )


def plan_for(destination, **deps):
    engine = make_engine(destination, **deps)
    turns = [ConversationTurn(role="traveler", content=f"5 days in {destination} from Surat")]
    response = engine.plan(PlanTripRequest(trip_id="trip-1", conversation=turns))
    assert response.status == "planned"
    return response.plan


def test_place_without_a_station_gets_trains_to_the_best_railhead_and_a_road_leg():
    plan = plan_for("Badrinath")

    [option] = plan.trains_out
    assert [leg.train_number for leg in option.legs] == ["12911"]
    assert option.legs[0].from_station == "Surat"
    assert option.legs[0].to_station == "Haridwar Jn"
    assert option.departs == "2026-12-15T16:15"
    assert option.arrives == "2026-12-16T14:30"
    assert option.runs_on == ["Tue"]
    assert plan.road_leg.from_place == "Haridwar Jn"
    assert plan.road_leg.to_place == "Badrinath"
    assert plan.road_leg.distance_km == 319
    assert [leg.train_number for leg in plan.trains_back[0].legs] == ["12912"]
    assert plan.timetable_as_of == "2026-08-30"


def test_railhead_is_picked_by_total_travel_time_not_by_who_leaves_first():
    # Rishikesh: 25 h + about 9 h of road. Haridwar: 22 h + about 9.5 h. Haridwar is quicker,
    # though 19031 reaches Rishikesh a day sooner because it leaves a day earlier.
    plan = plan_for("Badrinath")

    assert plan.road_leg.from_place == "Haridwar Jn"
    assert all(option.legs[0].train_number != "19031" for option in plan.trains_out)


def test_at_most_two_railheads_and_the_direct_road_are_routed():
    router = FakeRouter(DRIVES, default=Drive(km=1350, hours=22.0))

    plan_for("Badrinath", router=router)

    assert len(router.calls) <= 3


def test_return_trains_may_leave_the_day_after_check_out():
    plan = plan_for("Badrinath")

    assert plan.trains_back[0].departs == "2026-12-22T06:00"


def test_return_trains_leave_only_after_check_out_and_the_drive_back():
    # Check-out at 10:00 on Monday, then about 9.5 hours of road back to Haridwar.
    plan = plan_for("Badrinath")

    assert all(option.departs >= "2026-12-21T19:30" for option in plan.trains_back)
    assert all(option.legs[0].train_number != "22660" for option in plan.trains_back)


def test_return_trains_from_a_station_at_the_destination_leave_after_check_out():
    plan = plan_for("Haridwar")

    assert all(option.departs >= "2026-12-21T10:00" for option in plan.trains_back)


def test_no_trains_when_the_origin_is_already_at_the_railhead():
    plan = plan_for("Badrinath", origin="Rishikesh")

    assert plan.trains_out == [] and plan.trains_back == []
    assert plan.road_leg is None
    assert plan.road_route is not None
    assert not any("No train" in note for note in plan.notes)


def test_every_plan_also_gets_a_road_route_on_its_own():
    plan = plan_for("Badrinath")

    assert plan.road_route.from_place == "Surat"
    assert plan.road_route.to_place == "Badrinath"
    assert plan.road_route.distance_km == 1350
    assert (plan.road_route.hours_low, plan.road_route.hours_high) == (26.5, 35.0)


def test_winter_trip_to_a_shrine_gets_a_closure_note():
    plan = plan_for("Badrinath")

    assert any("Badrinath temple is usually closed" in note for note in plan.notes)


def test_destination_with_its_own_station_has_no_road_leg():
    plan = plan_for("Haridwar")

    assert [leg.train_number for leg in plan.trains_out[0].legs] == ["12911"]
    assert plan.road_leg is None
    assert plan.road_route is not None


def test_timetable_outage_still_plans_the_trip_with_a_road_route():
    plan = plan_for("Badrinath", timetable=FakeTimetable(error=TimetableError("gone")))

    assert plan.trains_out == []
    assert plan.road_route is not None
    assert "The train timetable is unavailable right now." in plan.notes


def test_routing_outage_still_gives_trains():
    plan = plan_for("Badrinath", router=FakeRouter(error=RouteError("down")))

    assert plan.trains_out
    assert plan.road_route is None
    assert plan.road_leg is None
    assert plan.notes.count("Road times are unavailable right now.") == 1


def test_place_lookup_outage_skips_trains_and_roads_with_one_note():
    plan = plan_for("Badrinath", places=FakePlaces(error=GeocodeError("down")))

    assert plan.trains_out == [] and plan.road_route is None
    assert (
        plan.notes.count(
            "Places could not be looked up right now, so train and road routes were skipped."
        )
        == 1
    )


def test_ambiguous_place_is_never_guessed():
    twins = [
        place("Badrinath", BADRINATH, importance=0.5),
        place("Badrinath", SURAT, importance=0.5),
    ]
    plan = plan_for("Badrinath", places=FakePlaces({**PLACES, "Badrinath": twins}))

    assert plan.trains_out == [] and plan.road_route is None
    assert any("Badrinath matches more than one place" in note for note in plan.notes)


def test_place_outside_india_skips_trains_and_roads():
    plan = plan_for("Dubai")

    assert plan.trains_out == [] and plan.road_route is None
    assert any("Dubai wasn't found in India" in note for note in plan.notes)
