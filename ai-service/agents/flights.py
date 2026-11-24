from domain.airports import airport_code
from graph.state import PlanningState
from ports.search import FlightQuery, FlightSearchPort, SearchError

MAX_FLIGHTS = 3
NO_ORIGIN = "Tell me where you're starting from to see flights, trains and the drive."


def make_flight_node(search: FlightSearchPort):
    def flights(state: PlanningState) -> PlanningState:
        request, dates, caps = state["request"], state["dates"], state["caps"]
        if not request.origin:
            return {"flights": [], "notes": [NO_ORIGIN]}
        budget_guessed = "budget" in state.get("assumed_fields", [])
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

        if not found:
            return {"flights": [], "notes": ["No flights were found for these dates."]}
        # Rule 2: fares within the per-Traveler cap (with grace) come first.
        by_price = sorted(found, key=lambda f: f.price_per_traveler)
        fitting = [f for f in by_price if caps.allows_flight(f.price_per_traveler)]
        if fitting or budget_guessed:
            # A guessed Budget never hides or flags real fares; the Traveler can set a Budget.
            return {"flights": (fitting or by_price)[:MAX_FLIGHTS]}
        # Over-cap fares are still shown, flagged, so the Traveler can compare them with trains.
        flagged = [f.model_copy(update={"over_budget": True}) for f in by_price[:MAX_FLIGHTS]]
        return {
            "flights": flagged,
            "notes": [
                f"Flights cost more than the flight share of your Budget (about "
                f"₹{caps.flight_search_limit:,} per Traveler; cheapest found "
                f"₹{by_price[0].price_per_traveler:,.0f}). Compare them with train, bus and car."
            ],
        }

    return flights
