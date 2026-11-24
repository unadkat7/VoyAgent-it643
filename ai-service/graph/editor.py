from collections.abc import Callable
from datetime import date

from agents.itinerary import SYSTEM as ITINERARY_SYSTEM
from domain.budget import BudgetCaps
from domain.dates import TripDates
from domain.spend import assumed_budget
from ports.llm import LLMPort
from schemas.api import ConversationTurn, EditPlanRequest, EditPlanResponse
from schemas.edit import PlanEdit
from schemas.itinerary import Itinerary
from schemas.plan import TripPlan

SYSTEM = """You help a Traveler adjust their VoyAgent Trip plan. Read their latest message
with the plan below.
- If they want Trip details changed (days, nights, dates, number of people, Budget, travel
  style, starting city, Destination, kind of stay), put only the new values in changes and
  leave every other field null. Budget is the total in INR for everyone (60k = 60000).
- If they want the day plan changed (add, remove, swap or move activities, a slower pace),
  describe the change in itinerary_change.
- If they ask a question or want suggestions, answer it in answer using the plan. Keep it
  short and practical, and never invent prices, train times or bookings.
Today is {today}."""

EDIT_DAYS_SYSTEM = (
    ITINERARY_SYSTEM
    + "\nYou are editing an existing Itinerary. Change only what the Traveler asks for and keep "
    "every other Activity exactly as it is."
)

# Changing these means new searches; the days can stay if only these changed.
REPLAN_FIELDS = (
    "destination",
    "origin",
    "duration_days",
    "nights",
    "start_date",
    "party_size",
    "budget",
    "travel_style",
    "accommodation_type",
)
DAYS_UNAFFECTED = frozenset({"origin", "party_size", "budget", "accommodation_type"})
RECENT_TURNS = 8
NOT_UNDERSTOOD = (
    'I couldn\'t tell what to change. Try something like "make it 4 days", '
    '"swap day 2 for a beach day" or ask me a question about the trip.'
)


class PlanEditor:
    """Applies one chat message to a finished plan: answer it, edit the days, or re-plan."""

    def __init__(self, *, llm: LLMPort, graph, today: Callable[[], date]):
        self._llm = llm
        self._graph = graph
        self._today = today

    def edit(self, body: EditPlanRequest) -> EditPlanResponse:
        plan = body.plan
        edit = self._llm.generate(
            PlanEdit,
            system=SYSTEM.format(today=self._today().isoformat()),
            prompt=_context(plan, body.conversation),
        )
        changed = _changed_fields(plan, edit)
        if changed:
            return self._replan(body, changed, edit.itinerary_change)
        if edit.itinerary_change:
            return self._edit_days(body, edit.itinerary_change)
        return EditPlanResponse(
            outcome="answered",
            change="question",
            trip_id=body.trip_id,
            reply=edit.answer or NOT_UNDERSTOOD,
        )

    def _replan(
        self, body: EditPlanRequest, changed: dict[str, object], days_change: str | None
    ) -> EditPlanResponse:
        plan = body.plan
        request = plan.request.model_copy(update=changed)
        if days_change:
            request = request.model_copy(
                update={"special_requests": [*request.special_requests, days_change]}
            )
        assumed = [f for f in plan.assumed_fields if f not in changed]
        if "budget" in assumed:
            # A guessed Budget follows the new days, group size and style.
            request = request.model_copy(
                update={
                    "budget": assumed_budget(
                        travel_style=request.travel_style,
                        days=request.duration_days,
                        party_size=request.party_size,
                    )
                }
            )
        state = {"request": request, "assumed_fields": assumed, "notes": []}
        if body.travel_mode:
            state["travel_mode"] = body.travel_mode
        if not days_change and set(changed) <= DAYS_UNAFFECTED:
            state["itinerary"] = plan.itinerary
        reply = f"Updated the plan for {_describe(changed)}. Stays, travel and costs re-checked."
        return self._run(body, state, reply, "request")

    def _edit_days(self, body: EditPlanRequest, days_change: str) -> EditPlanResponse:
        plan = body.plan
        no_pins = {"activities": {"__all__": {"coordinates"}}}
        current = [day.model_dump(exclude=no_pins) for day in plan.itinerary]
        edited = self._llm.generate(
            Itinerary,
            system=EDIT_DAYS_SYSTEM,
            prompt=(
                f"Trip Request: {plan.request.model_dump_json()}\n"
                f"Current days: {current}\n"
                f"Change: {days_change}"
            ),
        )
        dates = TripDates(
            check_in=date.fromisoformat(plan.check_in),
            check_out=date.fromisoformat(plan.check_out),
        )
        state = {
            "finish_only": True,
            "request": plan.request,
            "assumed_fields": plan.assumed_fields,
            "dates": dates,
            "caps": BudgetCaps.for_trip(
                budget=plan.request.budget, nights=dates.nights, party_size=plan.request.party_size
            ),
            "hotels": plan.hotels,
            "flights": plan.flights,
            "itinerary": edited.days,
            "trains_out": plan.trains_out,
            "trains_back": plan.trains_back,
            "road_route": plan.road_route,
            "road_leg": plan.road_leg,
            "timetable_as_of": plan.timetable_as_of,
            # Plans made before travel options were added rebuild them from their flights.
            "travel_options": plan.travel_options or None,
            "travel_mode": body.travel_mode,
            "notes": plan.notes,
        }
        # The planning state leaves out what a plan doesn't have, rather than holding None.
        state = {key: value for key, value in state.items() if value is not None}
        reply = f"Updated your day plan: {days_change}. Costs and map pins are re-checked."
        return self._run(body, state, reply, "itinerary")

    def _run(self, body: EditPlanRequest, state: dict, reply: str, change: str):
        result = self._graph.invoke(state)
        if clarification := result.get("clarification"):
            return EditPlanResponse(
                outcome="needs_clarification",
                change=change,
                trip_id=body.trip_id,
                reply=clarification.question,
            )
        return EditPlanResponse(
            outcome="updated",
            change=change,
            trip_id=body.trip_id,
            reply=reply,
            plan=result["plan"],
        )


def _changed_fields(plan: TripPlan, edit: PlanEdit) -> dict[str, object]:
    changed: dict[str, object] = {}
    for field in REPLAN_FIELDS:
        value = getattr(edit.changes, field)
        if value is None or (isinstance(value, str) and not value.strip()):
            continue
        if isinstance(value, int) and value <= 0:
            continue
        if value != getattr(plan.request, field):
            changed[field] = value
    # A new length with no nights stated books one night per day, as for a new Trip.
    if "duration_days" in changed and "nights" not in changed:
        changed["nights"] = None
    return changed


FIELD_WORDS = {
    "destination": lambda v: f"Destination {v}",
    "origin": lambda v: f"starting from {v}",
    "duration_days": lambda v: f"{v} days",
    "nights": lambda v: f"{v} nights",
    "start_date": lambda v: f"start date {v}",
    "party_size": lambda v: f"{v} travellers",
    "budget": lambda v: f"a ₹{v:,} budget",
    "travel_style": lambda v: f"a {v} style",
    "accommodation_type": lambda v: f"{v} stays",
}


def _describe(changed: dict[str, object]) -> str:
    return ", ".join(FIELD_WORDS[f](v) for f, v in changed.items() if v is not None)


def _context(plan: TripPlan, conversation: list[ConversationTurn]) -> str:
    speaker = {"traveler": "Traveler", "assistant": "Assistant"}
    turns = "\n".join(f"{speaker[t.role]}: {t.content}" for t in conversation[-RECENT_TURNS:])
    days = "\n".join(
        f"Day {d.day}: {d.title} — " + "; ".join(a.title for a in d.activities)
        for d in plan.itinerary
    )
    return (
        f"Trip Request: {plan.request.model_dump_json()}\n"
        f"Dates: {plan.check_in} to {plan.check_out} ({plan.nights} nights)\n"
        f"Stays: {[(h.name, h.price_per_night) for h in plan.hotels]}\n"
        f"Ways to travel: {[(o.label, o.total) for o in plan.travel_options]}\n"
        f"Estimated total: ₹{plan.estimated_cost.total:,.0f}\n"
        f"Days:\n{days}\n"
        f"Notes: {plan.notes}\n\n"
        f"Conversation:\n{turns}"
    )
