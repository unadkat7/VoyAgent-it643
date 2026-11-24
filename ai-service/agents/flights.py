from domain.airports import airport_code, known_code
from domain.money import format_money
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
        origin_code = airport_code(request.origin) or known_code(request.origin_airport)
        first, last = state["route"][0], state["route"][-1]
        single_stop = len(state["route"]) == 1
        dest_hint = known_code(request.destination_airport) if single_stop else None
        destination_code = airport_code(first.city) or first.airport_code or dest_hint
        return_code = airport_code(last.city) or last.airport_code or dest_hint
        # Rule 4: an unknown place is never swapped for another city's airport.
        if not origin_code or not destination_code or not return_code:
            place = (
                request.origin
                if not origin_code
                else first.city
                if not destination_code
                else last.city
            )
            alt = (
                " Consider train or road travel." if request.origin_area in (None, "india") else ""
            )
            return {
                "flights": [],
                "notes": [f"Flights were skipped: no airport is known for {place}.{alt}"],
            }

        country = (request.origin_country or "").lower() or None
        if len(state["route"]) > 1:
            selected, notes = [], []
            for direction, start, end, day in [
                ("outbound", origin_code, destination_code, dates.check_in),
                ("return", return_code, origin_code, dates.check_out),
            ]:
                try:
                    found = search.search_flights(
                        FlightQuery(
                            start,
                            end,
                            day,
                            None,
                            caps.flight_search_limit,
                            currency=request.currency,
                            country=country,
                        )
                    )
                except SearchError:
                    found = []
                if found:
                    cheapest = min(found, key=lambda f: f.price_per_traveler)
                    selected.append(cheapest.model_copy(update={"direction": direction}))
                else:
                    notes.append(f"No {direction} fare found for {start} to {end}.")
            if (
                len(selected) == 2
                and not budget_guessed
                and not caps.allows_flight(sum(f.price_per_traveler for f in selected))
            ):
                selected = [f.model_copy(update={"over_budget": True}) for f in selected]
                notes.append("The combined outbound and return fares exceed your flight budget.")
            return {"flights": selected, "notes": notes}
        query = FlightQuery(
            origin_airport=origin_code,
            destination_airport=destination_code,
            outbound_date=dates.check_in,
            return_date=dates.check_out,
            max_price_per_traveler=caps.flight_search_limit,
            currency=request.currency,
            country=country,
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
        cur = request.currency
        return {
            "flights": flagged,
            "notes": [
                f"Flights cost more than the flight share of your Budget (about "
                f"{format_money(caps.flight_search_limit, cur)} per Traveler; cheapest found "
                f"{format_money(by_price[0].price_per_traveler, cur)}). "
                "Compare them with train, bus and car."
            ],
        }

    return flights
