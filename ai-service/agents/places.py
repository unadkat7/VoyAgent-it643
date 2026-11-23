from domain.places import PlaceMatch, pick_place
from ports.places import PlaceFinderPort

PLACES_DOWN = "Places could not be looked up right now, so train and road routes were skipped."


def find_place(places: PlaceFinderPort, name: str) -> tuple[PlaceMatch | None, str | None]:
    """The place a name means, or a Note saying why it can't be used. Raises GeocodeError."""
    matches = places.find_settlements(name)
    if not matches:
        return None, f"{name} wasn't found in India, so train and road routes were skipped."
    chosen = pick_place(matches)
    if chosen is None:
        return None, (
            f"{name} matches more than one place, so train and road routes were skipped. "
            "Adding the state name helps."
        )
    return chosen, None
