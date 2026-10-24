from dataclasses import dataclass
from datetime import date, timedelta

DEFAULT_LEAD_DAYS = 30


@dataclass(frozen=True)
class TripDates:
    """Travel Dates. A 3-day Trip books 3 nights: check-out is the day after the last day."""

    check_in: date
    check_out: date

    @property
    def nights(self) -> int:
        return (self.check_out - self.check_in).days

    @classmethod
    def resolve(cls, *, start_date: str | None, duration_days: int, today: date) -> "TripDates":
        if duration_days <= 0:
            raise ValueError("duration_days must be positive")
        default_start = today + timedelta(days=DEFAULT_LEAD_DAYS)
        check_in = _parse_future_date(start_date, today) or default_start
        return cls(check_in=check_in, check_out=check_in + timedelta(days=duration_days))


def _parse_future_date(text: str | None, today: date) -> date | None:
    if not text:
        return None
    try:
        parsed = date.fromisoformat(text)
    except ValueError:
        return None
    return parsed if parsed >= today else None
