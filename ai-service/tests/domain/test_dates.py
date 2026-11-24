from datetime import date

import pytest

from domain.dates import TripDates, nights_fit

TODAY = date(2026, 11, 22)


def test_start_date_and_duration_give_check_out():
    dates = TripDates.resolve(start_date="2026-12-10", duration_days=4, today=TODAY)

    assert dates.check_in == date(2026, 12, 10)
    assert dates.check_out == date(2026, 12, 14)
    assert dates.nights == 4


def test_without_start_date_trip_starts_thirty_days_from_today():
    dates = TripDates.resolve(start_date=None, duration_days=3, today=TODAY)

    assert dates.check_in == date(2026, 12, 22)
    assert dates.nights == 3


def test_start_date_in_the_past_is_moved_to_the_default_start():
    dates = TripDates.resolve(start_date="2026-01-01", duration_days=2, today=TODAY)

    assert dates.check_in == date(2026, 12, 22)


def test_unreadable_start_date_falls_back_to_default_start():
    dates = TripDates.resolve(start_date="next friday", duration_days=2, today=TODAY)

    assert dates.check_in == date(2026, 12, 22)


def test_three_days_two_nights_checks_out_on_the_last_day():
    dates = TripDates.resolve(start_date="2026-12-10", duration_days=3, today=TODAY, nights=2)

    assert dates.check_out == date(2026, 12, 12)
    assert dates.nights == 2


@pytest.mark.parametrize("nights", [0, 1, 4, 7])
def test_nights_that_do_not_fit_the_days_are_ignored(nights):
    dates = TripDates.resolve(start_date="2026-12-10", duration_days=3, today=TODAY, nights=nights)

    assert dates.nights == 3


@pytest.mark.parametrize(
    ("days", "nights", "fits"),
    [(3, 3, True), (3, 2, True), (3, 1, False), (3, 4, False), (1, 1, True), (1, 0, False)],
)
def test_nights_fit_on_and_off_points(days, nights, fits):
    assert nights_fit(days, nights) is fits
