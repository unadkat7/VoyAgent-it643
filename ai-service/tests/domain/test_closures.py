from datetime import date

import pytest

from domain.closures import closure_note


def test_winter_trip_to_kedarnath_gets_a_note():
    note = closure_note("Kedarnath", date(2026, 12, 15), date(2026, 12, 20))

    assert note == (
        "Kedarnath temple is usually closed from about November to April. "
        "Check this year's opening dates before you travel."
    )


def test_summer_trip_has_no_note():
    assert closure_note("Kedarnath", date(2026, 6, 10), date(2026, 6, 14)) is None


def test_trip_that_starts_in_the_closed_months_gets_a_note():
    assert closure_note("Badrinath", date(2026, 4, 28), date(2026, 5, 3)) is not None


@pytest.mark.parametrize("destination", ["kedarnath dham", "Kedarnath, Uttarakhand", "KEDARNATH"])
def test_the_name_is_matched_loosely(destination):
    assert closure_note(destination, date(2026, 1, 5), date(2026, 1, 8)) is not None


def test_other_destinations_have_no_note():
    assert closure_note("Goa", date(2026, 12, 15), date(2026, 12, 20)) is None
