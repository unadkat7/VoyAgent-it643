from collections.abc import Callable
from datetime import date

from domain.budget import BudgetCaps
from domain.closures import closure_note
from domain.dates import TripDates
from graph.state import PlanningState


def make_prepare_node(today: Callable[[], date]):
    def prepare(state: PlanningState) -> PlanningState:
        request = state["request"]
        dates = TripDates.resolve(
            start_date=request.start_date, duration_days=request.duration_days, today=today()
        )
        caps = BudgetCaps.for_trip(
            budget=request.budget, nights=dates.nights, party_size=request.party_size
        )
        notes = []
        if request.start_date and request.start_date != dates.check_in.isoformat():
            notes.append(
                f"The start date '{request.start_date}' could not be used, "
                f"so the Trip is planned from {dates.check_in.isoformat()}."
            )
        if closed := closure_note(request.destination, dates.check_in, dates.check_out):
            notes.append(closed)
        return {"dates": dates, "caps": caps, "notes": notes}

    return prepare
