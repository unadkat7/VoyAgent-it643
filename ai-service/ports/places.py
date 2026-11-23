from typing import Protocol

from domain.places import PlaceMatch


class PlaceFinderPort(Protocol):
    def find_settlements(self, name: str) -> list[PlaceMatch]:
        """Towns, cities and regions in India with this name, best first. Raises GeocodeError."""
        ...
