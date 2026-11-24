from graph.state import PlanningState
from ports.fares import FareError, FarePort, FareQuery

FARES_DOWN = "Train and bus fares could not be found right now; check IRCTC or redBus."


def make_fares_node(fares: FarePort):
    """Approximate train and bus fares from the web, for the Travel tab and the total."""

    def fares_step(state: PlanningState) -> PlanningState:
        request, dates = state["request"], state["dates"]
        if not request.origin:
            return {}  # the flight step asks for the Origin once
        query = FareQuery(
            origin=request.origin,
            destination=request.destination,
            month=dates.check_in.strftime("%B %Y"),
        )
        try:
            return {"fares": fares.estimate(query)}
        except FareError:
            return {"notes": [FARES_DOWN]}

    return fares_step
