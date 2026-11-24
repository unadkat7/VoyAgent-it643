"""Turns the OurAirports CSV into the city -> airport code map the Planning Engine reads.

Usage: uv run python scripts/build_airports.py <airports.csv> [data/airports.json]
Source (public domain): https://davidmegginson.github.io/ourairports-data/airports.csv
"""

import csv
import json
import re
import sys
import unicodedata
from pathlib import Path

SOURCE = "https://ourairports.com/data/"
DEFAULT_OUT = Path(__file__).resolve().parent.parent / "data" / "airports.json"
SIZE_RANK = {"large_airport": 0, "medium_airport": 1}


def _city_names(municipality: str) -> set[str]:
    """ "Muscat/Seeb" and "Kuta, Badung" name two places; "Malé" is also typed "male"."""
    names = set()
    for part in re.split(r"[/,]", municipality):
        name = part.strip().lower()
        if name:
            names.add(name)
            names.add(unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode())
    return {name for name in names if name}


def build(csv_path: Path, out: Path) -> dict:
    # city -> country -> best (size rank, OurAirports id, code)
    found: dict[str, dict[str, tuple[int, int, str]]] = {}
    with csv_path.open(encoding="utf-8", newline="") as raw:
        for row in csv.DictReader(raw):
            code = row["iata_code"].strip()
            if row["type"] not in SIZE_RANK or row["scheduled_service"] != "yes" or len(code) != 3:
                continue
            candidate = (SIZE_RANK[row["type"]], int(row["id"]), code)
            for city in _city_names(row["municipality"]):
                by_country = found.setdefault(city, {})
                best = by_country.get(row["iso_country"])
                if best is None or candidate < best:
                    by_country[row["iso_country"]] = candidate

    airports, ambiguous = {}, 0
    for city, by_country in sorted(found.items()):
        # Keep a shared city name only when one large airport beats smaller rivals.
        large = [c for c in by_country.values() if c[0] == 0]
        if len(by_country) == 1:
            airports[city] = next(iter(by_country.values()))[2]
        elif len(large) == 1:
            airports[city] = large[0][2]
        else:
            ambiguous += 1
    data = {"source": SOURCE, "airports": airports}
    out.write_text(json.dumps(data, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
    print(f"{len(airports)} cities written to {out}; {ambiguous} shared names skipped")
    return data


if __name__ == "__main__":
    if len(sys.argv) not in (2, 3):
        sys.exit(__doc__)
    build(Path(sys.argv[1]), Path(sys.argv[2]) if len(sys.argv) == 3 else DEFAULT_OUT)
