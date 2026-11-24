from graph.state import PlanningState
from schemas.api import Clarification

QUESTIONS = {
    "origin": "Where will you be starting from (which city)?",
    "destination": "Where would you like to go?",
    "duration_days": "How many days will the Trip be?",
    "budget": "What is your total Budget for everyone, and in which currency?",
    "party_size": "How many Travelers are going, including you?",
    "travel_style": "What style of Trip do you want (budget, relaxed, luxury, adventure, family)?",
}


def clarify(state: PlanningState) -> PlanningState:
    missing = state["missing_fields"]
    lines = "\n".join(f"- {QUESTIONS[field]}" for field in missing)
    question = f"Before I plan your Trip, I need a little more information:\n{lines}"
    return {"clarification": Clarification(missing_fields=missing, question=question)}
