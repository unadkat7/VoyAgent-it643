from adapters.no_geocoder import NoGeocoder
from domain.place_rules import PlaceProblem, kind_problem, number_problem
from graph.state import PlanningState
from ports.geocoder import GeocodeError, GeocoderPort
from schemas.api import Clarification


def ask_about(problem: PlaceProblem) -> PlanningState:
    return {
        "clarification": Clarification(
            missing_fields=[problem.field], question=problem.question, reason=problem.reason
        )
    }


def make_check_places_node(geocoder: GeocoderPort):
    def check_places(state: PlanningState) -> PlanningState:
        request = state["request"]
        places = [
            ("destination", request.destination, request.destination_kind, request.destination_area)
        ]
        if request.origin:
            places.append(("origin", request.origin, request.origin_kind, None))
        for field, name, kind, area in places:
            if problem := kind_problem(field, name, kind, area):
                return ask_about(problem)
        if problem := number_problem(request):
            return ask_about(problem)
        notes = []
        for field, name, kind, _ in places:
            if kind == "multi_country" or isinstance(geocoder, NoGeocoder):
                continue
            try:
                if geocoder.locate_area(name) is None:
                    return ask_about(
                        PlaceProblem(
                            field,
                            f"I couldn't find '{name}' on the map. "
                            "Check the spelling or name a nearby city.",
                            "not_a_place",
                        )
                    )
            except GeocodeError:
                notes.append(f"I couldn't double-check '{name}' on the map right now.")
        return {"notes": notes}

    return check_places
