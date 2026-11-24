from domain.spend import TRAVELERS_PER_ROOM
from graph.state import PlanningState
from ports.search import HotelQuery, HotelSearchPort, SearchError

MAX_HOTELS = 3


def make_hotel_node(search: HotelSearchPort):
    def hotels(state: PlanningState) -> PlanningState:
        request, dates, caps = state["request"], state["dates"], state["caps"]
        query = HotelQuery(
            destination=request.destination,
            check_in=dates.check_in,
            check_out=dates.check_out,
            # Prices are per room, and two Travelers share one; the cost step counts the rooms.
            adults=min(request.party_size, TRAVELERS_PER_ROOM),
            max_price_per_night=caps.hotel_search_limit,
            travel_style=request.travel_style,
            accommodation_type=request.accommodation_type,
        )
        try:
            found = search.search_hotels(query)
        except SearchError:
            return {
                "hotels": [],
                "notes": ["Hotel search is unavailable right now, so no stays are suggested."],
            }
        if not found:
            return {
                "hotels": [],
                "notes": [f"No hotels were found in {request.destination} for these dates."],
            }

        # Rule 2: only stays within the nightly cap become Recommendations.
        fitting = [h for h in found if caps.allows_hotel(h.price_per_night)]
        if not fitting:
            cheapest = sorted(found, key=lambda h: h.price_per_night)
            return {
                "hotels": [],
                "hotels_over_budget": True,
                "cheapest_hotel_price": cheapest[0].price_per_night,
                "hotels_over_cap": cheapest[:MAX_HOTELS],
            }
        ranked = sorted(fitting, key=lambda h: (-(h.rating or 0), h.price_per_night))
        return {"hotels": ranked[:MAX_HOTELS]}

    return hotels
