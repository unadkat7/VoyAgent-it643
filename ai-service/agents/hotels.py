from domain.spend import TRAVELERS_PER_ROOM
from graph.state import PlanningState
from ports.search import HotelQuery, HotelSearchPort, SearchError

MAX_HOTELS = 3


def make_hotel_node(search: HotelSearchPort):
    def hotels(state: PlanningState) -> PlanningState:
        request, caps = state["request"], state["caps"]
        groups, notes = [], []
        over_cap = {}
        for stop, dates in zip(state["route"], state["stop_dates"], strict=True):
            query = HotelQuery(
                destination=stop.city,
                check_in=dates.check_in,
                check_out=dates.check_out,
                adults=min(request.party_size, TRAVELERS_PER_ROOM),
                max_price_per_night=caps.hotel_search_limit,
                travel_style=request.travel_style,
                accommodation_type=request.accommodation_type,
                currency=request.currency,
                country=(request.origin_country or "").lower() or None,
            )
            try:
                found = search.search_hotels(query)
            except SearchError:
                notes.append(f"Hotel search is unavailable in {stop.city} right now.")
                groups.append([])
                continue
            fitting = sorted(
                (h for h in found if caps.allows_hotel(h.price_per_night)),
                key=lambda h: (-(h.rating or 0), h.price_per_night),
            )
            if not found:
                notes.append(f"No hotels were found in {stop.city} for these dates.")
            elif not fitting:
                cheapest = sorted(found, key=lambda h: h.price_per_night)
                over_cap[stop.city] = cheapest[0].price_per_night
                if "budget" in state.get("assumed_fields", []):
                    fitting = cheapest
            groups.append(fitting[:MAX_HOTELS])
        result = {"hotels": groups[0], "stop_hotels": groups, "notes": notes}
        if over_cap:
            city = max(over_cap, key=over_cap.get)
            result.update(
                hotels_over_budget=True, cheapest_hotel_price=over_cap[city], over_budget_city=city
            )
        return result

    return hotels
