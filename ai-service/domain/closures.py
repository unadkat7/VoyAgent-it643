from datetime import date, timedelta

# Shrines that usually shut for winter. Exact dates are announced each year, so this is a Note only.
SEASONAL_CLOSURES: dict[str, tuple[str, tuple[int, ...]]] = {
    "kedarnath": ("Kedarnath temple", (11, 12, 1, 2, 3, 4)),
    "badrinath": ("Badrinath temple", (11, 12, 1, 2, 3, 4)),
    "gangotri": ("Gangotri temple", (11, 12, 1, 2, 3, 4)),
    "yamunotri": ("Yamunotri temple", (11, 12, 1, 2, 3, 4)),
    "hemkund": ("Hemkund Sahib", (10, 11, 12, 1, 2, 3, 4, 5)),
}

MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]  # fmt: skip


def closure_note(destination: str, check_in: date, check_out: date) -> str | None:
    place = destination.lower()
    for key, (name, closed) in SEASONAL_CLOSURES.items():
        if key not in place:
            continue
        days = (check_in + timedelta(days=n) for n in range((check_out - check_in).days + 1))
        if any(day.month in closed for day in days):
            return (
                f"{name} is usually closed from about {MONTHS[closed[0] - 1]} to "
                f"{MONTHS[closed[-1] - 1]}. Check this year's opening dates before you travel."
            )
    return None
