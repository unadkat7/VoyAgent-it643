import zipfile
from datetime import date

import pytest

from adapters.gtfs_timetable import GtfsTimetable
from ports.timetable import TimetableError
from scripts.build_timetable import build

GTFS = {
    "feed_info.txt": "feed_publisher_name,feed_version\nTest,2026-08-30-02-22-43\n",
    "stops.txt": (
        "stop_id,stop_name,stop_lat,stop_lon\n"
        "ST,SURAT,21.206418,72.840643\n"
        "BRC,VADODARA JN,22.310,73.181\n"
        "HW,HARIDWAR JN,29.9481,78.1552\n"
        "RKSH,RISHIKESH,30.1075,78.2878\n"
    ),
    "routes.txt": (
        "route_id,route_long_name\n12911,BL HARIDWAR EXP\n54483,HW-RKSH PASSENGER\n99999,NO CALENDAR\n"
    ),
    "trips.txt": (
        "route_id,service_id,trip_id\n"
        "12911,Tue_20260819-20270830,12911\n"
        "54483,Daily_20260101-20270830,54483\n"
        "99999,Missing,99999\n"
    ),
    "calendar.txt": (
        "service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\n"
        "Tue_20260819-20270830,0,1,0,0,0,0,0,20260819,20270830\n"
        "Daily_20260101-20270830,1,1,1,1,1,1,1,20260101,20270830\n"
    ),
    "stop_times.txt": (
        "trip_id,arrival_time,departure_time,stop_id,stop_sequence\n"
        "12911,16:10:00,16:15:00,ST,3\n"
        "12911,17:40:00,17:45:00,BRC,4\n"
        "12911,38:30:00,38:30:00,HW,15\n"
        "54483,10:40:00,10:40:00,HW,1\n"
        "54483,11:45:00,11:45:00,RKSH,5\n"
        "99999,10:00:00,10:00:00,ST,1\n"
        "99999,11:00:00,11:00:00,BRC,2\n"
    ),
    "shapes.txt": "shape_id,shape_pt_lat,shape_pt_lon,shape_pt_sequence\nX,1,1,1\n",
}


@pytest.fixture
def timetable_file(tmp_path):
    gtfs_zip = tmp_path / "gtfs.zip"
    with zipfile.ZipFile(gtfs_zip, "w") as archive:
        for name, text in GTFS.items():
            archive.writestr(name, text)
    out = tmp_path / "timetable.json.gz"
    summary = build(gtfs_zip, out)
    return out, summary


def test_build_keeps_trains_with_a_calendar_and_reports_what_it_kept(timetable_file):
    _, summary = timetable_file

    assert summary == {"stations": 4, "trains": 2, "skipped": 1, "as_of": "2026-08-30"}


def test_loaded_timetable_has_stations_trains_and_running_days(timetable_file):
    out, _ = timetable_file

    timetable = GtfsTimetable(out).load()

    assert timetable.as_of == "2026-08-30"
    assert timetable.stations["HW"].name == "HARIDWAR JN"
    assert timetable.stations["HW"].point.lat == pytest.approx(29.9481)
    train = next(t for t in timetable.trains if t.number == "12911")
    assert train.name == "BL HARIDWAR EXP"
    assert train.runs_on(date(2026, 12, 15))  # a Tuesday
    assert not train.runs_on(date(2026, 12, 16))
    assert not train.runs_on(date(2026, 8, 18))  # before its first day


def test_stops_keep_their_order_and_overnight_minutes(timetable_file):
    out, _ = timetable_file

    train = next(t for t in GtfsTimetable(out).load().trains if t.number == "12911")

    assert [stop.station for stop in train.stops] == ["ST", "BRC", "HW"]
    assert (train.stops[0].arrive, train.stops[0].depart) == (16 * 60 + 10, 16 * 60 + 15)
    assert train.stops[-1].arrive == 38 * 60 + 30  # 14:30 on the next day


def test_the_file_is_read_once(timetable_file):
    out, _ = timetable_file
    source = GtfsTimetable(out)

    assert source.load() is source.load()


def test_missing_file_is_a_timetable_error(tmp_path):
    with pytest.raises(TimetableError):
        GtfsTimetable(tmp_path / "missing.json.gz").load()


def test_corrupt_file_is_a_timetable_error(tmp_path):
    broken = tmp_path / "broken.json.gz"
    broken.write_bytes(b"not gzip")

    with pytest.raises(TimetableError):
        GtfsTimetable(broken).load()
