import gzip
import json
import threading
from datetime import date
from pathlib import Path

from domain.timetable import Station, Stop, Timetable, Train
from ports.timetable import TimetableError
from schemas.geo import GeoPoint


class GtfsTimetable:
    """Reads the compact timetable built by scripts/build_timetable.py, once per process."""

    def __init__(self, path: Path):
        self._path = Path(path)
        self._lock = threading.Lock()
        self._timetable: Timetable | None = None

    def load(self) -> Timetable:
        with self._lock:
            if self._timetable is None:
                self._timetable = self._read()
            return self._timetable

    def _read(self) -> Timetable:
        try:
            with gzip.open(self._path, "rt", encoding="utf-8") as handle:
                data = json.load(handle)
            stations = [
                Station(code=code, name=name, point=GeoPoint(lat=lat, lng=lng))
                for code, name, lat, lng in data["stations"]
            ]
            trains = tuple(
                Train(
                    number=number,
                    name=name,
                    weekdays=frozenset(i for i, flag in enumerate(days) if flag == "1"),
                    first_day=date.fromisoformat(first),
                    last_day=date.fromisoformat(last),
                    stops=tuple(
                        Stop(station=stations[index].code, arrive=arrive, depart=depart)
                        for index, arrive, depart in calls
                    ),
                )
                for number, name, days, first, last, calls in data["trains"]
            )
            return Timetable(
                as_of=data["as_of"],
                stations={station.code: station for station in stations},
                trains=trains,
            )
        except (OSError, EOFError, ValueError, KeyError, TypeError, IndexError) as error:
            raise TimetableError(f"Cannot read the timetable at {self._path}: {error}") from error
