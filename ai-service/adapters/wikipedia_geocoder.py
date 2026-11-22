import re
import threading

import httpx

from ports.geocoder import GeocodeError
from schemas.geo import GeoPoint, Region

WIKIPEDIA_API_URL = "https://en.wikipedia.org/w/api.php"
USER_AGENT = "VoyAgent/1.0 (trip planner)"

# Generic words that should not carry a landmark match on their own.
_GENERIC_WORDS = frozenset(
    {
        "temple",
        "mandir",
        "masjid",
        "mosque",
        "church",
        "beach",
        "fort",
        "palace",
        "museum",
        "park",
        "garden",
        "lake",
        "ghat",
        "market",
        "bazaar",
        "road",
        "street",
        "hotel",
        "resort",
        "stay",
        "homestay",
        "restaurant",
        "cafe",
        "dhaba",
        "campus",
        "complex",
        "center",
        "centre",
        "near",
        "old",
        "new",
        "city",
        "north",
        "south",
        "east",
        "west",
        "shree",
        "shri",
        "sri",
    }
)


def _tokens(text: str) -> set[str]:
    return {word for word in re.findall(r"[a-z0-9]+", text.lower()) if len(word) >= 3}


def _distinctive_tokens(place: str, destination: str) -> set[str]:
    dest_tokens = _tokens(destination)
    return _tokens(place) - _GENERIC_WORDS - dest_tokens


def _title_matches_place(title: str, place: str, destination: str) -> bool:
    if title.strip().lower() == destination.strip().lower():
        return False
    needed = _distinctive_tokens(place, destination)
    if not needed:
        return False
    title_tokens = _tokens(title)
    # Every distinctive word of the place must appear in the Wikipedia article title
    # (prevents "Sandipani Ashram" from matching unrelated "Sandipani ... Pratishthan").
    return needed.issubset(title_tokens)


class WikipediaGeocoder:
    """Free Wikipedia landmark geocoder for famous POIs that Nominatim maps as streets."""

    def __init__(
        self,
        *,
        api_url: str = WIKIPEDIA_API_URL,
        timeout_seconds: float = 6.0,
    ):
        self._url = api_url
        self._timeout = timeout_seconds
        self._lock = threading.Lock()
        self._cache: dict[str, GeoPoint | None] = {}

    def locate_area(self, query: str) -> Region | None:
        # Landmark articles carry a point but no area; areas come from Nominatim.
        return None

    def locate(self, query: str, near: Region | None = None) -> GeoPoint | None:
        # Only handle qualified "Place, Destination" queries; let Nominatim handle bare cities.
        if "," not in query:
            return None
        place, destination = (part.strip() for part in query.rsplit(",", 1))
        if not place or not destination or not _distinctive_tokens(place, destination):
            return None

        with self._lock:
            if query in self._cache:
                return self._cache[query]
            point = self._fetch(place, destination)
            self._cache[query] = point
            return point

    def _fetch(self, place: str, destination: str) -> GeoPoint | None:
        try:
            response = httpx.get(
                self._url,
                params={
                    "action": "query",
                    "generator": "search",
                    "gsrsearch": f"{place} {destination}",
                    "gsrlimit": 5,
                    "prop": "coordinates",
                    "format": "json",
                },
                headers={"User-Agent": USER_AGENT},
                timeout=self._timeout,
            )
            response.raise_for_status()
            pages = response.json().get("query", {}).get("pages", {})
            for page in sorted(pages.values(), key=lambda p: p.get("index", 99)):
                title = page.get("title", "")
                coords = page.get("coordinates")
                if not coords or not _title_matches_place(title, place, destination):
                    continue
                return GeoPoint(lat=float(coords[0]["lat"]), lng=float(coords[0]["lon"]))
            return None
        except (httpx.HTTPError, ValueError, KeyError, TypeError) as error:
            raise GeocodeError(f"Wikipedia failed for {place!r}: {error}") from error
