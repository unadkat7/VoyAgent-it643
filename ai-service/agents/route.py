import re

from adapters.no_geocoder import NoGeocoder
from agents.check_places import ask_about
from domain.place_rules import PlaceProblem
from domain.route_rules import connect_stops, destination_bases, feasibility_problem, fit_stops
from graph.state import PlanningState
from ports.geocoder import GeocodeError, GeocoderPort
from ports.llm import LLMPort
from schemas.route import RoutePlan, RouteStop

ROUTE_SYSTEM = """Pick an ordered route of base cities realistic for travellers starting from the
given origin. Use only overnight bases inside the requested destination. Never include the origin,
transit airports or the final journey home as stops. Give each country. Prefer three or four cities
for ten days.
Minimize border crossings. Choose cities linked by inexpensive trains or flights. Allow at least
two days per city, and use the given total days. Include each city's main airport IATA code.
For each consecutive pair give the usual mode and rough cost per person in the currency given in
the request's `currency` field, using the same city names as the stops. Never claim bookings or
exact prices."""


def make_route_node(llm: LLMPort, geocoder: GeocoderPort):
    def route(state: PlanningState) -> PlanningState:
        request = state["request"]
        if problem := feasibility_problem(request, state.get("assumed_fields", [])):
            return ask_about(problem)
        if request.destination_kind != "multi_country":
            return {
                "route": [RouteStop(city=request.destination, days=request.duration_days)],
                "legs": [],
            }
        proposed = llm.generate(RoutePlan, system=ROUTE_SYSTEM, prompt=request.model_dump_json())
        stops, notes = fit_stops(destination_bases(proposed.stops, request), request.duration_days)
        known = []
        for stop in stops:
            try:
                if not isinstance(geocoder, NoGeocoder) and geocoder.locate_area(stop.city) is None:
                    notes.append(f"I couldn't find {stop.city} on the map, so I left it out.")
                    continue
            except GeocodeError:
                notes.append(f"I couldn't double-check '{stop.city}' on the map right now.")
            code = stop.airport_code
            known.append(
                stop.model_copy(
                    update={"airport_code": code if re.fullmatch("[A-Z]{3}", code or "") else None}
                )
            )
        stops, _ = fit_stops(known, request.duration_days)
        if not stops:
            return ask_about(
                PlaceProblem(
                    "destination",
                    f"I couldn't build a route for {request.destination}. "
                    "Which countries or cities should I include?",
                )
            )
        legs, unpriced = connect_stops(stops, proposed.legs)
        return {"route": stops, "legs": legs, "notes": notes + unpriced}

    return route
