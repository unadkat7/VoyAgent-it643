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
}


def airport_code(place: str | None) -> str | None:
    """Rule 4: an unknown place has no airport. Never fall back to another city."""
    if not place or not place.strip():
        return None
    cleaned = place.strip()
    known = CITY_AIRPORT_CODES.get(cleaned.lower())
    if known:
        return known
    # Only an explicit uppercase code counts, so a city like "Una" is not read as an IATA code.
    if len(cleaned) == 3 and cleaned.isalpha() and cleaned.isupper():
        return cleaned
    return None
