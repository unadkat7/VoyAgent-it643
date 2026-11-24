import json
from functools import cache
from pathlib import Path

CITY_AIRPORT_CODES: dict[str, str] = {
    # India
    "mumbai": "BOM",
    "delhi": "DEL",
    "new delhi": "DEL",
    "goa": "GOI",
    "bangalore": "BLR",
    "bengaluru": "BLR",
    "hyderabad": "HYD",
    "chennai": "MAA",
    "kolkata": "CCU",
    "pune": "PNQ",
    "ahmedabad": "AMD",
    "jaipur": "JAI",
    "kochi": "COK",
    "cochin": "COK",
    "udaipur": "UDR",
    "varanasi": "VNS",
    "amritsar": "ATQ",
    "srinagar": "SXR",
    "leh": "IXL",
    "lucknow": "LKO",
    "indore": "IDR",
    "surat": "STV",
    "vadodara": "BDQ",
    "rajkot": "HSR",
    "chandigarh": "IXC",
    "port blair": "IXZ",
    "andaman": "IXZ",
    "bhubaneswar": "BBI",
    "guwahati": "GAU",
    "thiruvananthapuram": "TRV",
    "trivandrum": "TRV",
    # International
    "dubai": "DXB",
    "abu dhabi": "AUH",
    "london": "LHR",
    "new york": "JFK",
    "nyc": "JFK",
    "new york city": "JFK",
    "la": "LAX",
    "washington dc": "IAD",
    "san francisco": "SFO",
    "tokyo": "HND",
    "paris": "CDG",
    "rome": "FCO",
    "singapore": "SIN",
    "bangkok": "BKK",
    "bali": "DPS",
    "zurich": "ZRH",
    "sydney": "SYD",
    "kathmandu": "KTM",
    "colombo": "CMB",
    "male": "MLE",
    "maldives": "MLE",
    "istanbul": "IST",
}
# Every other city with scheduled flights; built by scripts/build_airports.py from OurAirports.
AIRPORTS_FILE = Path(__file__).resolve().parent.parent / "data" / "airports.json"


@cache
def _bundled_codes() -> dict[str, str]:
    return json.loads(AIRPORTS_FILE.read_text(encoding="utf-8"))["airports"]


@cache
def _known_codes() -> frozenset[str]:
    return frozenset(CITY_AIRPORT_CODES.values()) | frozenset(_bundled_codes().values())


def known_code(code: str | None) -> str | None:
    """Accept an IATA code only if it belongs to a known airport."""
    if not code or not code.strip():
        return None
    cleaned = code.strip().upper()
    return cleaned if cleaned in _known_codes() else None


def airport_code(place: str | None) -> str | None:
    """Rule 4: an unknown place has no airport. Never fall back to another city."""
    if not place or not place.strip():
        return None
    cleaned = place.strip()
    # The hand list wins: it picks the main airport where a city has several.
    known = CITY_AIRPORT_CODES.get(cleaned.lower()) or _bundled_codes().get(cleaned.lower())
    if known:
        return known
    # Only an explicit uppercase code counts, so a city like "Una" is not read as an IATA code.
    if len(cleaned) == 3 and cleaned.isalpha() and cleaned.isupper():
        return known_code(cleaned)
    return None
