from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta

from domain.timetable import Station, Timetable, Train
from schemas.geo import GeoPoint, distance_km

MIN_CHANGE = timedelta(minutes=45)
MAX_CHANGE = timedelta(hours=10)
STATION_RADIUS_KM = 15.0
MAX_STATION_RADIUS_KM = 60.0
RAILHEAD_MAX_KM = 350.0
RAILHEAD_MIN_DAILY_TRAINS = 10
MAX_RAILHEADS = 3
MAX_JOURNEYS = 3
CHANGE_PENALTY_MINUTES = 3 * 60


@dataclass(frozen=True)
class Leg:
    """One train ridden from the stop at `board` to the stop at `alight`."""

    train: Train
    board: int
    alight: int
    service_day: date

    @property
    def from_code(self) -> str:
        return self.train.stops[self.board].station

    @property
    def to_code(self) -> str:
        return self.train.stops[self.alight].station

    @property
    def departs(self) -> datetime:
        return _at(self.service_day, self.train.stops[self.board].depart)

    @property
    def arrives(self) -> datetime:
        return _at(self.service_day, self.train.stops[self.alight].arrive)


@dataclass(frozen=True)
class Journey:
    """A Train Option: one train, or two with a change at the same Station."""

    legs: tuple[Leg, ...]

    @property
    def departs(self) -> datetime:
        return self.legs[0].departs

    @property
    def arrives(self) -> datetime:
        return self.legs[-1].arrives

    @property
    def minutes(self) -> int:
        return int((self.arrives - self.departs).total_seconds() // 60)

    @property
    def change_at(self) -> str | None:
        return self.legs[0].to_code if len(self.legs) > 1 else None

    @property
    def wait_minutes(self) -> int | None:
        if len(self.legs) < 2:
            return None
        return int((self.legs[1].departs - self.legs[0].arrives).total_seconds() // 60)


def _at(day: date, minutes: int) -> datetime:
    return datetime.combine(day, time()) + timedelta(minutes=minutes)


def station_radius_km(place_radius_km: float) -> float:
    """How far from a place its own Stations may be: bigger places (Goa, Delhi) reach farther."""
    return min(MAX_STATION_RADIUS_KM, max(STATION_RADIUS_KM, place_radius_km))


def stations_near(
    timetable: Timetable,
    point: GeoPoint,
    radius_km: float,
    *,
    min_daily_trains: float = 0,
    limit: int | None = None,
) -> list[Station]:
    by_distance = sorted(
        (distance_km(point, station.point), station.code, station)
        for station in timetable.stations.values()
        if timetable.daily_trains.get(station.code, 0) >= max(min_daily_trains, 1e-9)
    )
    found = [station for km, _code, station in by_distance if km <= radius_km]
    return found[:limit] if limit is not None else found


def railheads(timetable: Timetable, point: GeoPoint) -> list[Station]:
    """Busy Stations near a place that has none of its own; the rest of the way is by road."""
    return stations_near(
        timetable,
        point,
        RAILHEAD_MAX_KM,
        min_daily_trains=RAILHEAD_MIN_DAILY_TRAINS,
        limit=MAX_RAILHEADS,
    )


def find_journeys(
    timetable: Timetable,
    origins: Iterable[str],
    destinations: Iterable[str],
    depart_days: Sequence[date],
    *,
    arrive_by: datetime | None = None,
    limit: int = MAX_JOURNEYS,
) -> list[Journey]:
    """Direct trains and one-change journeys, best first. Times come only from the timetable."""
    origins, destinations = set(origins), set(destinations)
    days = set(depart_days)
    onward = _onward_calls(timetable, destinations)
    found: dict[tuple[str, ...], Journey] = {}

    for code in origins:
        for first, board in timetable.calls_at.get(code, []):
            depart_minute = first.stops[board].depart
            for day in days:
                service_day = day - timedelta(days=depart_minute // 1440)
                if not first.runs_on(service_day):
                    continue
                for journey in _journeys_from(
                    first, board, service_day, origins, destinations, onward
                ):
                    if arrive_by is None or journey.arrives <= arrive_by:
                        key = tuple(leg.train.number for leg in journey.legs)
                        best = found.get(key)
                        if best is None or _rank(journey) < _rank(best):
                            found[key] = journey

    return sorted(found.values(), key=_rank)[:limit]


def _rank(journey: Journey) -> tuple[int, datetime]:
    # Travelers prefer staying on one train, so a change counts as CHANGE_PENALTY extra time.
    changes = len(journey.legs) - 1
    return journey.minutes + changes * CHANGE_PENALTY_MINUTES, journey.departs


def _onward_calls(
    timetable: Timetable, destinations: set[str]
) -> dict[str, list[tuple[Train, int, int]]]:
    """Per Station: (train, board index, alight index) for trains that go on to a destination."""
    onward: dict[str, list[tuple[Train, int, int]]] = {}
    for code in destinations:
        for train, alight in timetable.calls_at.get(code, []):
            for board in range(alight):
                onward.setdefault(train.stops[board].station, []).append((train, board, alight))
    return onward


def _journeys_from(first, board, service_day, origins, destinations, onward):
    stops = first.stops
    for position in range(board + 1, len(stops)):
        station = stops[position].station
        if station in destinations:
            yield Journey(legs=(Leg(first, board, position, service_day),))
            return  # past a destination, a change can only be slower
        if station in origins:
            continue
        first_leg = Leg(first, board, position, service_day)
        for second, second_board, alight in onward.get(station, []):
            # Changing onto a train that already stops at the origin is never worth it.
            if second is first or _calls_before(second, second_board, origins):
                continue
            yield from _connections(first_leg, second, second_board, alight)


def _calls_before(train: Train, position: int, stations: set[str]) -> bool:
    return any(stop.station in stations for stop in train.stops[:position])


def _connections(first_leg: Leg, second: Train, board: int, alight: int):
    arrives = first_leg.arrives
    depart_minute = second.stops[board].depart
    earliest = arrives + MIN_CHANGE - timedelta(minutes=depart_minute)
    latest = arrives + MAX_CHANGE - timedelta(minutes=depart_minute)
    day = earliest.date()
    while day <= latest.date():
        leg = Leg(second, board, alight, day)
        if second.runs_on(day) and MIN_CHANGE <= leg.departs - arrives <= MAX_CHANGE:
            yield Journey(legs=(first_leg, leg))
        day += timedelta(days=1)
