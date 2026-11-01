from collections.abc import Callable
from datetime import date

from domain.requirements import find_missing_fields
from graph.state import PlanningState
from ports.llm import LLMPort
from schemas.api import ConversationTurn
from schemas.trip_request import TripRequest

SYSTEM = """You are the Planner of VoyAgent, a travel planning assistant for Indian travellers.
Read the whole Conversation and extract the latest Trip Request.
- Use only facts the Traveler stated. Never guess; leave unknown fields null.
- origin is the city the Travel Party starts from.
- budget is the total for the whole Travel Party in INR as a whole number (50k = 50000).
- party_size counts every Traveler, including the speaker ("me and my wife" = 2).
- start_date is YYYY-MM-DD. Today is {today}; resolve relative dates like "next Friday".
- If the Traveler changes a detail later in the Conversation, the latest value wins."""


def render_conversation(turns: list[ConversationTurn]) -> str:
    speaker = {"traveler": "Traveler", "assistant": "Assistant"}
    return "\n".join(f"{speaker[turn.role]}: {turn.content}" for turn in turns)


def make_understand_node(llm: LLMPort, today: Callable[[], date]):
    def understand(state: PlanningState) -> PlanningState:
        request = llm.generate(
            TripRequest,
            system=SYSTEM.format(today=today().isoformat()),
            prompt=render_conversation(state["conversation"]),
        )
        # Rule 1 decides what is missing; the LLM only extracts values.
        return {"request": request, "missing_fields": find_missing_fields(request.model_dump())}

    return understand


def route_after_understand(state: PlanningState) -> str:
    return "clarify" if state["missing_fields"] else "prepare"
