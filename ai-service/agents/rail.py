from datetime import datetime, time, timedelta

from agents.places import find_place
from agents.road import ROADS_DOWN
from domain.rail import (
    Journey,
    find_journeys,
    railheads,
    station_radius_km,
    stations_near,
    travel_minutes,
)
from domain.roads import SLOW_FACTOR_LOW, Drive, estimated_road_minutes, road_route
from domain.timetable import Station, Timetable
from graph.state import PlanningState
from ports.geocoder import GeocodeError
from ports.places import PlaceFinderPort
from ports.roads import RouteError, RouterPort
from ports.timetable import TimetableError, TimetablePort
from schemas.geo import GeoPoint, distance_km
from schemas.travel import TrainLeg, TrainOption

TIMETABLE_DOWN = "The train timetable is unavailable right now."
# A long train ride may start up to two days before check-in; the way back the day after check-out.
DAYS_BEFORE_CHECK_IN = 2
DAYS_AFTER_CHECK_OUT = 1
ROUTED_RAILHEADS = 2
CHECK_OUT_TIME = time(10, 0)
WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


def make_rail_node(timetable: TimetablePort, places: PlaceFinderPort, router: RouterPort | None):
    """Train Options there and back. Train times come only from the timetable, never the LLM."""

    def rail(state: PlanningState) -> PlanningState:
        if state["request"].destination_area not in (None, "india"):
            return {}
        request, dates = state["request"], state["dates"]
        if not request.origin:
            return {}  # the flight step asks for the Origin once
        try:
            table = timetable.load()
        except TimetableError:
            return {"notes": [TIMETABLE_DOWN]}
        try:
            origin, _ = find_place(places, request.origin)
            destination, _ = find_place(places, request.destination)
        except GeocodeError:
            return {}  # the road step reports place problems once
        if origin is None or destination is None:
            return {}

        starts = stations_near(table, origin.point, station_radius_km(origin.radius_km))
        if not starts:
            return {"notes": [f"No train station was found near {request.origin}."]}
        start_codes = {station.code for station in starts}

        out_days = [dates.check_in - timedelta(days=n) for n in range(DAYS_BEFORE_CHECK_IN, -1, -1)]
        back_days = [dates.check_out + timedelta(days=n) for n in range(DAYS_AFTER_CHECK_OUT + 1)]
        arrive_by = datetime.combine(dates.check_in, time.max)
        update: PlanningState = {"timetable_as_of": table.as_of}
        notes: list[str] = []

        ends = stations_near(table, destination.point, station_radius_km(destination.radius_km))
        heads = [] if ends else railheads(table, destination.point)
        # Already at the Destination's station or railhead: the road route is the whole answer.
        if {s.code for s in ends + heads} & start_codes:
            return update

        checked_out = datetime.combine(dates.check_out, CHECK_OUT_TIME)
        if ends:
            end_codes = {station.code for station in ends}
            trains_out = find_journeys(table, start_codes, end_codes, out_days, arrive_by=arrive_by)
            trains_back = find_journeys(
                table, end_codes, start_codes, back_days, depart_after=checked_out
            )
        else:
            choice = _best_railhead(
                table, heads, start_codes, destination.point, out_days, arrive_by, router
            )
            if choice is None:
                trains_out, trains_back = [], []
            else:
                head, trains_out, drive, road_failed = choice
                # Back at the railhead only after checking out and driving down again.
                at_railhead = checked_out + timedelta(
                    minutes=_road_minutes(drive, head, destination.point)
                )
                trains_back = find_journeys(
                    table, {head.code}, start_codes, back_days, depart_after=at_railhead
                )
                if drive is not None:
                    update["road_leg"] = road_route(drive, _title(head.name), request.destination)
                if road_failed:
                    notes.append(ROADS_DOWN)

        if not trains_out:
            notes.append(
                f"No train with at most one change reaches {request.destination} "
                f"by {dates.check_in.isoformat()}."
            )
        update["trains_out"] = [_option(j, table) for j in trains_out]
        update["trains_back"] = [_option(j, table) for j in trains_back]
        update["notes"] = notes
        return update

    return rail


def _best_railhead(table, heads, start_codes, point: GeoPoint, out_days, arrive_by, router):
    """The railhead with the shortest total trip: train time (changes count extra) plus road time.

    Total time, not arrival time: otherwise a train that leaves a day earlier always wins.
    Every railhead is searched; only a shortlist is routed, to keep the router's load low.
    """
    candidates = []
    for head in heads:
        # Reaching the railhead on check-in day is enough: a long hill drive can run into the night.
        journeys = find_journeys(table, start_codes, {head.code}, out_days, arrive_by=arrive_by)
        if journeys:
            rough = estimated_road_minutes(distance_km(head.point, point))
            candidates.append((travel_minutes(journeys[0]) + rough, head, journeys))
    if not candidates:
        return None
    candidates.sort(key=lambda candidate: candidate[0])

    best = None
    road_failed = False
    for estimate, head, journeys in candidates[:ROUTED_RAILHEADS]:
        drive: Drive | None = None
        if router is not None and not road_failed:
            try:
                drive = router.drive(head.point, point)
            except RouteError:
                road_failed = True
        total = estimate
        if drive is not None:
            total = travel_minutes(journeys[0]) + _road_minutes(drive, head, point)
        if best is None or total < best[0]:
            best = (total, head, journeys, drive)
    _, head, journeys, drive = best
    return head, journeys, drive, road_failed


def _road_minutes(drive: Drive | None, head: Station, point: GeoPoint) -> float:
    """Routed drive time slowed for hills, or the rough estimate when routing is unavailable."""
    if drive is not None:
        return drive.hours * SLOW_FACTOR_LOW * 60
    return estimated_road_minutes(distance_km(head.point, point))


def _title(name: str) -> str:
    return name.title()


def _option(journey: Journey, table: Timetable) -> TrainOption:
    def station(code: str) -> Station:
        return table.stations[code]

    legs = [
        TrainLeg(
            train_number=leg.train.number,
            train_name=_title(leg.train.name),
            from_code=leg.from_code,
            from_station=_title(station(leg.from_code).name),
            to_code=leg.to_code,
            to_station=_title(station(leg.to_code).name),
            departs=leg.departs.isoformat(timespec="minutes"),
            arrives=leg.arrives.isoformat(timespec="minutes"),
        )
        for leg in journey.legs
    ]
    first_train = journey.legs[0].train
    return TrainOption(
        legs=legs,
        departs=legs[0].departs,
        arrives=legs[-1].arrives,
        duration_minutes=journey.minutes,
        change_at=_title(station(journey.change_at).name) if journey.change_at else None,
        wait_minutes=journey.wait_minutes,
        runs_on=[WEEKDAYS[day] for day in sorted(first_train.weekdays)],
    )
