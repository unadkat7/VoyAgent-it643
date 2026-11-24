from agents.places import PLACES_DOWN, find_place
from domain.roads import road_end_note, road_route
from graph.state import PlanningState
from ports.geocoder import GeocodeError
from ports.places import PlaceFinderPort
from ports.roads import RouteError, RouterPort

ROADS_DOWN = "Road times are unavailable right now."


def make_road_node(places: PlaceFinderPort, router: RouterPort):
    """Origin to Destination by road: a travel option of its own, next to flights and trains."""

    def road(state: PlanningState) -> PlanningState:
        request = state["request"]
        if not request.origin:
            return {}  # the flight step asks for the Origin once
        # The router drives across continents (Mumbai to Paris), so only same-area trips get a car.
        if (request.origin_area or "india") != (request.destination_area or "india"):
            return {}
        try:
            origin, origin_note = find_place(places, request.origin)
            destination, destination_note = find_place(places, request.destination)
        except GeocodeError:
            return {"notes": [PLACES_DOWN]}
        if origin is None or destination is None:
            return {"notes": [note for note in (origin_note, destination_note) if note]}

        try:
            drive = router.drive(origin.point, destination.point)
        except RouteError:
            return {"notes": [ROADS_DOWN]}
        if drive is None:
            return {
                "notes": [
                    f"No road route was found from {request.origin} to {request.destination}."
                ]
            }

        route = road_route(drive, request.origin, request.destination)
        end_note = road_end_note(route)
        return {"road_route": route, "notes": [end_note] if end_note else []}

    return road
