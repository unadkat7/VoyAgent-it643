from collections.abc import Callable
from datetime import date

from domain.budget import BudgetCaps
from domain.closures import closure_note
from domain.dates import TripDates, nights_fit
from graph.state import PlanningState


def make_prepare_node(today: Callable[[], date]):
    def prepare(state: PlanningState) -> PlanningState:
        request = state["request"]
        dates = TripDates.resolve(
            start_date=request.start_date,
            duration_days=request.duration_days,
            today=today(),
            nights=request.nights,
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
        if request.nights is not None and not nights_fit(request.duration_days, request.nights):
            notes.append(
                f"You asked for {request.nights} nights on a {request.duration_days}-day Trip, "
                f"which don't line up, so this plan has {request.duration_days} days and "
                f"{dates.nights} nights (check-in {dates.check_in.isoformat()}, check-out "
                f"{dates.check_out.isoformat()}). Tell me if you want it changed."
            )
        if closed := closure_note(request.destination, dates.check_in, dates.check_out):
            notes.append(closed)
        return {"dates": dates, "caps": caps, "notes": notes}

    return prepare
