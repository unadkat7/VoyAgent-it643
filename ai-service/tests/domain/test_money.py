from domain.money import format_money, from_inr, trip_currency


def test_trip_currency_picks_stated_then_origin_country_then_inr():
    assert trip_currency("USD", None) == ("USD", None)
    assert trip_currency(None, "GB") == ("GBP", None)
    assert trip_currency(None, None) == ("INR", None)


def test_trip_currency_falls_back_to_usd_with_note_when_unsupported():
    code, note = trip_currency("XYZ", "US")
    assert code == "USD"
    assert note is not None
    assert "XYZ" in note


def test_from_inr_scales_using_table_and_keeps_inr_exact():
    assert from_inr(8_400, "USD") == 100
    assert from_inr(40_000, "INR") == 40_000


def test_format_money_uses_symbols_or_iso_code():
    assert format_money(1500, "USD") == "$1,500"
    assert format_money(40000, "INR") == "₹40,000"
    assert format_money(1500, "AED") == "AED 1,500"
