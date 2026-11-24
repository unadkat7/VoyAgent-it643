from domain.travel_costs import price_trains
from graph.state import PlanningState
from ports.fares import FareError, FarePort, FareQuery, TrainSegment
from schemas.travel import TrainOption

FARES_DOWN = "Train and bus fares could not be found right now; check IRCTC or redBus."
TRAIN_FARES_DOWN = "Train fares could not be found for these trains right now; check IRCTC."
# Each segment is one web search, so only the best few options there and back are priced.
PRICED_OPTIONS = 2
MAX_SEGMENTS = 4


def make_fares_node(fares: FarePort):
    """Approximate train and bus fares from the web: for the route, and for each train found."""

    def fares_step(state: PlanningState) -> PlanningState:
        if state["request"].destination_area not in (None, "india"):
            return {}
        request, dates = state["request"], state["dates"]
        if not request.origin:
            return {}  # the flight step asks for the Origin once
        month = dates.check_in.strftime("%B %Y")
        update: PlanningState = {}
        notes = []
        try:
            update["fares"] = fares.estimate(
                FareQuery(origin=request.origin, destination=request.destination, month=month)
            )
        except FareError:
            notes.append(FARES_DOWN)

        trains_out, trains_back = state.get("trains_out", []), state.get("trains_back", [])
        if segments := train_segments(trains_out, trains_back):
            try:
                found = fares.train_fares(segments, month)
                update["trains_out"] = price_trains(trains_out, found)
                update["trains_back"] = price_trains(trains_back, found)
            except FareError:
                notes.append(TRAIN_FARES_DOWN)
        if notes:
            update["notes"] = notes
        return update

    return fares_step


def train_segments(out: list[TrainOption], back: list[TrainOption]) -> list[TrainSegment]:
    segments: dict[tuple[str, str, str], TrainSegment] = {}
    for option in out[:PRICED_OPTIONS] + back[:PRICED_OPTIONS]:
        for leg in option.legs:
            key = (leg.train_number, leg.from_code, leg.to_code)
            segments.setdefault(
                key,
                TrainSegment(leg.train_number, leg.train_name, leg.from_station, leg.to_station),
            )
    return list(segments.values())[:MAX_SEGMENTS]
