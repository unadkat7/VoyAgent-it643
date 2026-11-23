from dataclasses import dataclass
from datetime import date
from functools import cached_property

from schemas.geo import GeoPoint


@dataclass(frozen=True)
class Station:
    code: str
    name: str
    point: GeoPoint


@dataclass(frozen=True)
class Stop:
    """A train's call at a Station. Minutes count from midnight of the day the train starts."""

    station: str
    arrive: int
    depart: int


@dataclass(frozen=True)
class Train:
    number: str
    name: str
    weekdays: frozenset[int]  # 0 = Monday, as in date.weekday()
    first_day: date
    last_day: date
    stops: tuple[Stop, ...]

    def runs_on(self, day: date) -> bool:
        """True when the train starts its run on `day`."""
        return self.first_day <= day <= self.last_day and day.weekday() in self.weekdays


@dataclass(frozen=True)
class Timetable:
    as_of: str
    stations: dict[str, Station]
    trains: tuple[Train, ...]

    @cached_property
    def calls_at(self) -> dict[str, list[tuple[Train, int]]]:
        """For each Station, the trains that call there and the index of that call."""
        index: dict[str, list[tuple[Train, int]]] = {}
        for train in self.trains:
            for position, stop in enumerate(train.stops):
                index.setdefault(stop.station, []).append((train, position))
        return index

    @cached_property
    def daily_trains(self) -> dict[str, float]:
        """Average number of trains calling at each Station per day."""
        return {
            code: sum(len(train.weekdays) for train, _ in calls) / 7
            for code, calls in self.calls_at.items()
        }
