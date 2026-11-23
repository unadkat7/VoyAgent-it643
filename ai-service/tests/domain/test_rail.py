from datetime import date, datetime

import pytest

from domain.rail import find_journeys, railheads, station_radius_km, stations_near
from domain.timetable import Station, Stop, Timetable, Train
from schemas.geo import GeoPoint

TUE, WED = date(2026, 12, 15), date(2026, 12, 16)
ALL_DAYS = range(7)

STATIONS = {
    "ST": (21.2064, 72.8406),
    "BRC": (22.3100, 73.1810),
    "HW": (29.9481, 78.1552),
    "RKSH": (30.1075, 78.2878),
    "DDN": (30.3125, 78.0335),
    "FAR": (20.0000, 90.0000),
}


def minutes(clock: str) -> int:
    hours, mins = clock.split(":")
    return int(hours) * 60 + int(mins)


def train(number, stops, days=ALL_DAYS):
    return Train(
        number=number,
        name=f"TRAIN {number}",
        weekdays=frozenset(days),
        first_day=date(2026, 1, 1),
        last_day=date(2027, 8, 30),
        stops=tuple(Stop(station=s, arrive=minutes(a), depart=minutes(d)) for s, a, d in stops),
    )


def timetable(*trains):
    stations = {
        code: Station(code=code, name=code, point=GeoPoint(lat=lat, lng=lng))
        for code, (lat, lng) in STATIONS.items()
    }
    return Timetable(as_of="2026-08-30", stations=stations, trains=tuple(trains))


SURAT_HARIDWAR = train("12911", [("ST", "16:10", "16:15"), ("HW", "38:30", "38:30")], days=[1])


def test_direct_train_on_a_day_it_runs():
    [journey] = find_journeys(timetable(SURAT_HARIDWAR), {"ST"}, {"HW"}, [TUE])

    assert [leg.train.number for leg in journey.legs] == ["12911"]
    assert journey.departs == datetime(2026, 12, 15, 16, 15)
    assert journey.arrives == datetime(2026, 12, 16, 14, 30)
    assert journey.minutes == 22 * 60 + 15
    assert journey.change_at is None


def test_no_journey_on_a_day_the_train_does_not_run():
    assert find_journeys(timetable(SURAT_HARIDWAR), {"ST"}, {"HW"}, [WED]) == []


def test_train_that_starts_the_evening_before_counts_on_the_day_it_reaches_the_origin():
    # Starts Monday 22:00 elsewhere, reaches Surat at 01:00 on Tuesday.
    night = train(
        "19019",
        [("BRC", "22:00", "22:00"), ("ST", "25:00", "25:05"), ("HW", "50:00", "50:00")],
        days=[0],
    )
    table = timetable(night)

    [journey] = find_journeys(table, {"ST"}, {"HW"}, [TUE])
    assert journey.departs == datetime(2026, 12, 15, 1, 5)
    assert journey.legs[0].service_day == date(2026, 12, 14)
    assert find_journeys(table, {"ST"}, {"HW"}, [date(2026, 12, 14)]) == []


def test_one_change_when_there_is_no_direct_train():
    passenger = train("54483", [("HW", "16:00", "16:00"), ("RKSH", "17:05", "17:05")])

    [journey] = find_journeys(timetable(SURAT_HARIDWAR, passenger), {"ST"}, {"RKSH"}, [TUE])

    assert [leg.train.number for leg in journey.legs] == ["12911", "54483"]
    assert journey.change_at == "HW"
    assert journey.wait_minutes == 90
    assert journey.arrives == datetime(2026, 12, 16, 17, 5)


# 12911 reaches Haridwar at 14:30; a change needs 45 minutes to 10 hours.
@pytest.mark.parametrize(
    ("departs", "found"),
    [("15:14", False), ("15:15", True), ("24:30", True), ("24:31", False)],
)
def test_change_wait_limits(departs, found):
    onward = train("54483", [("HW", departs, departs), ("RKSH", "26:00", "26:00")])

    journeys = find_journeys(timetable(SURAT_HARIDWAR, onward), {"ST"}, {"RKSH"}, [TUE])

    assert bool(journeys) is found


def test_best_three_by_journey_time():
    slow = train("1", [("ST", "06:00", "06:00"), ("HW", "40:00", "40:00")])
    fast = train("2", [("ST", "07:00", "07:00"), ("HW", "27:00", "27:00")])
    medium = train("3", [("ST", "08:00", "08:00"), ("HW", "32:00", "32:00")])
    slowest = train("4", [("ST", "09:00", "09:00"), ("HW", "50:00", "50:00")])

    journeys = find_journeys(timetable(slow, fast, medium, slowest), {"ST"}, {"HW"}, [TUE])

    assert [j.legs[0].train.number for j in journeys] == ["2", "3", "1"]


def test_a_direct_train_beats_a_change_that_saves_less_than_three_hours():
    to_ratlam = train("12263", [("ST", "16:55", "16:55"), ("BRC", "18:00", "18:00")])
    onward = train("12055", [("BRC", "19:00", "19:00"), ("HW", "37:55", "37:55")])  # 21h total

    journeys = find_journeys(timetable(SURAT_HARIDWAR, to_ratlam, onward), {"ST"}, {"HW"}, [TUE])

    assert [j.legs[0].train.number for j in journeys] == ["12911", "12263"]


def test_no_change_onto_a_train_that_already_stops_at_the_origin():
    # Riding 12263 to Vadodara just to catch 12911, which already calls at Surat, is pointless.
    to_vadodara = train("12263", [("ST", "16:00", "16:00"), ("BRC", "17:00", "17:00")])
    surat_haridwar = train(
        "12911",
        [("ST", "16:10", "16:15"), ("BRC", "17:50", "17:55"), ("HW", "38:30", "38:30")],
        days=[1],
    )

    journeys = find_journeys(timetable(surat_haridwar, to_vadodara), {"ST"}, {"HW"}, [TUE])

    assert [[leg.train.number for leg in j.legs] for j in journeys] == [["12911"]]


def test_no_change_off_a_train_that_goes_on_to_the_destination():
    # 22660 calls at Vadodara and then Surat; getting off at Vadodara to change only loses time.
    through = train(
        "22660", [("HW", "07:45", "07:45"), ("BRC", "25:15", "25:20"), ("ST", "27:00", "27:00")]
    )
    local = train("12833", [("BRC", "26:09", "26:09"), ("ST", "28:26", "28:26")])

    journeys = find_journeys(timetable(through, local), {"HW"}, {"ST"}, [TUE])

    assert [[leg.train.number for leg in j.legs] for j in journeys] == [["22660"]]


def test_depart_after_drops_trains_that_leave_too_early():
    journeys = find_journeys(
        timetable(SURAT_HARIDWAR), {"ST"}, {"HW"}, [TUE], depart_after=datetime(2026, 12, 15, 17, 0)
    )

    assert journeys == []


def test_arrive_by_drops_late_arrivals():
    journeys = find_journeys(
        timetable(SURAT_HARIDWAR), {"ST"}, {"HW"}, [TUE], arrive_by=datetime(2026, 12, 16, 12, 0)
    )

    assert journeys == []


def test_train_going_the_other_way_is_not_a_journey():
    back = train("12912", [("HW", "06:00", "06:00"), ("ST", "28:00", "28:00")])

    assert find_journeys(timetable(back), {"ST"}, {"HW"}, [TUE]) == []


def test_stations_near_a_point_are_nearest_first_within_the_radius():
    local = train(
        "L", [("RKSH", "08:00", "08:00"), ("HW", "09:00", "09:00"), ("DDN", "10:00", "10:00")]
    )
    table = timetable(local)
    rishikesh = GeoPoint(lat=30.109, lng=78.292)

    near = stations_near(table, rishikesh, 15)

    assert [s.code for s in near] == ["RKSH"]
    assert [s.code for s in stations_near(table, rishikesh, 40)] == ["RKSH", "HW", "DDN"]


def test_a_station_no_train_calls_at_is_never_offered():
    rishikesh = GeoPoint(lat=30.109, lng=78.292)

    assert stations_near(timetable(), rishikesh, 15) == []


def test_railheads_are_busy_stations_within_350_km():
    busy = [train(str(n), [("HW", "10:00", "10:00"), ("DDN", "12:00", "12:00")]) for n in range(10)]
    quiet = train("Q", [("RKSH", "10:00", "10:00"), ("HW", "11:00", "11:00")])
    badrinath = GeoPoint(lat=30.742, lng=79.493)

    heads = railheads(timetable(*busy, quiet), badrinath)

    assert [s.code for s in heads] == ["DDN", "HW"]  # RKSH has one train a day; FAR is too far


@pytest.mark.parametrize(("radius", "expected"), [(0, 15), (20, 20), (300, 60)])
def test_station_radius_grows_with_the_place_but_is_capped(radius, expected):
    assert station_radius_km(radius) == expected
