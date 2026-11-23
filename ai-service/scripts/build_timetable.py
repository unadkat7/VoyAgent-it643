"""Turns an Indian Railways GTFS zip into the compact timetable the Planning Engine reads.

Usage: uv run python scripts/build_timetable.py <gtfs.zip> [data/timetable.json.gz]
Source feed: https://github.com/Neo2308/indianrailways-gtfs (credited in the README).
"""

import csv
import gzip
import io
import json
import sys
import zipfile
from pathlib import Path

SOURCE = "https://github.com/Neo2308/indianrailways-gtfs"
DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
DEFAULT_OUT = Path(__file__).resolve().parent.parent / "data" / "timetable.json.gz"


def _rows(archive: zipfile.ZipFile, name: str):
    with archive.open(name) as raw:
        yield from csv.DictReader(io.TextIOWrapper(raw, encoding="utf-8-sig", newline=""))


def _minutes(clock: str) -> int:
    hours, minutes, _seconds = (int(part) for part in clock.split(":"))
    return hours * 60 + minutes


def _iso(yyyymmdd: str) -> str:
    return f"{yyyymmdd[:4]}-{yyyymmdd[4:6]}-{yyyymmdd[6:]}"


def build(gtfs_zip: Path, out: Path) -> dict:
    with zipfile.ZipFile(gtfs_zip) as archive:
        version = next(_rows(archive, "feed_info.txt"))["feed_version"]
        calendar = {row["service_id"]: row for row in _rows(archive, "calendar.txt")}
        names = {row["route_id"]: row["route_long_name"] for row in _rows(archive, "routes.txt")}
        trips = {row["trip_id"]: row for row in _rows(archive, "trips.txt")}

        stations = []
        station_index = {}
        for row in _rows(archive, "stops.txt"):
            station_index[row["stop_id"]] = len(stations)
            lat, lng = round(float(row["stop_lat"]), 5), round(float(row["stop_lon"]), 5)
            stations.append([row["stop_id"], row["stop_name"], lat, lng])

        calls: dict[str, list[tuple[int, int, int, int]]] = {}
        for row in _rows(archive, "stop_times.txt"):
            calls.setdefault(row["trip_id"], []).append(
                (
                    int(row["stop_sequence"]),
                    station_index[row["stop_id"]],
                    _minutes(row["arrival_time"]),
                    _minutes(row["departure_time"]),
                )
            )

    trains, skipped = [], 0
    for trip_id, trip in trips.items():
        service = calendar.get(trip["service_id"])
        stops = sorted(calls.get(trip_id, []))
        if service is None or len(stops) < 2:
            skipped += 1
            continue
        weekdays = "".join(service[day] for day in DAYS)
        trains.append(
            [
                trip_id,
                names.get(trip["route_id"], trip_id),
                weekdays,
                _iso(service["start_date"]),
                _iso(service["end_date"]),
                [[station, arrive, depart] for _seq, station, arrive, depart in stops],
            ]
        )

    as_of = version[:10]
    payload = {
        "version": version,
        "as_of": as_of,
        "source": SOURCE,
        "stations": stations,
        "trains": trains,
    }
    out.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(out, "wt", encoding="utf-8") as handle:
        json.dump(payload, handle, separators=(",", ":"))
    return {"stations": len(stations), "trains": len(trains), "skipped": skipped, "as_of": as_of}


if __name__ == "__main__":
    if len(sys.argv) not in (2, 3):
        sys.exit(__doc__)
    target = Path(sys.argv[2]) if len(sys.argv) == 3 else DEFAULT_OUT
    print(build(Path(sys.argv[1]), target))
