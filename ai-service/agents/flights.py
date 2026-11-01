from domain.airports import airport_code
from graph.state import PlanningState
from ports.search import FlightQuery, FlightSearchPort, SearchError

MAX_FLIGHTS = 3


def make_flight_node(search: FlightSearchPort):
    def flights(state: PlanningState) -> PlanningState:
        request, dates, caps = state["request"], state["dates"], state["caps"]
        origin_code = airport_code(request.origin)
        destination_code = airport_code(request.destination)
        # Rule 4: an unknown place is never swapped for another city's airport.
        if not origin_code or not destination_code:
            place = request.origin if not origin_code else request.destination
            return {
                "flights": [],
                "notes": [
                    f"Flights were skipped: no airport is known for {place}. "
                    "Consider train or road travel."
                ],
            }

        query = FlightQuery(
            origin_airport=origin_code,
            destination_airport=destination_code,
            outbound_date=dates.check_in,
            return_date=dates.check_out,
            max_price_per_traveler=caps.flight_search_limit,
        )
        try:
            found = search.search_flights(query)
        except SearchError:
            return {"flights": [], "notes": ["Flight search is unavailable right now."]}

        # Rule 2: only fares within the per-Traveler cap (with grace) are recommended.
        fitting = sorted(
            (f for f in found if caps.allows_flight(f.price_per_traveler)),
            key=lambda f: f.price_per_traveler,
        )
        if found and not fitting:
            cheapest = min(f.price_per_traveler for f in found)
            return {
                "flights": [],
                "notes": [
                    f"No round-trip flight fits about ₹{caps.flight_search_limit:,} per Traveler "
                    f"(cheapest found ₹{cheapest:,.0f}). Consider train or bus."
                ],
            }
        if not found:
            return {"flights": [], "notes": ["No flights were found for these dates."]}
        return {"flights": fitting[:MAX_FLIGHTS]}

    return flights
