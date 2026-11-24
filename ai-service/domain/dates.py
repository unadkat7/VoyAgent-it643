from dataclasses import dataclass
from datetime import date, timedelta

DEFAULT_LEAD_DAYS = 30


@dataclass(frozen=True)
class TripDates:
    """Travel Dates. A 3-day Trip books 3 nights unless the Traveler asked for one fewer (3D/2N)."""

    check_in: date
    check_out: date

    @property
    def nights(self) -> int:
        return (self.check_out - self.check_in).days

    @classmethod
    def resolve(
        cls,
        *,
        start_date: str | None,
        duration_days: int,
        today: date,
        nights: int | None = None,
    ) -> "TripDates":
        if duration_days <= 0:
            raise ValueError("duration_days must be positive")
        default_start = today + timedelta(days=DEFAULT_LEAD_DAYS)
        check_in = _parse_future_date(start_date, today) or default_start
        booked = nights if nights_fit(duration_days, nights) else duration_days
        return cls(check_in=check_in, check_out=check_in + timedelta(days=booked))


def nights_fit(duration_days: int, nights: int | None) -> bool:
    """Stated nights fit a Trip of D days when they are D or D-1, and at least one."""
    return nights is not None and max(1, duration_days - 1) <= nights <= duration_days


def _parse_future_date(text: str | None, today: date) -> date | None:
    if not text:
        return None
    try:
        parsed = date.fromisoformat(text)
    except ValueError:
        return None
    return parsed if parsed >= today else None
