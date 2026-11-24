from typing import Literal

CurrencyCode = Literal[
    "INR",
    "USD",
    "EUR",
    "GBP",
    "AED",
    "SAR",
    "QAR",
    "SGD",
    "MYR",
    "THB",
    "IDR",
    "JPY",
    "CNY",
    "HKD",
    "AUD",
    "NZD",
    "CAD",
    "CHF",
    "ZAR",
    "NPR",
    "LKR",
]

SUPPORTED: tuple[CurrencyCode, ...] = (
    "INR",
    "USD",
    "EUR",
    "GBP",
    "AED",
    "SAR",
    "QAR",
    "SGD",
    "MYR",
    "THB",
    "IDR",
    "JPY",
    "CNY",
    "HKD",
    "AUD",
    "NZD",
    "CAD",
    "CHF",
    "ZAR",
    "NPR",
    "LKR",
)

# Approximate, Nov 2026, for planning floors only.
INR_PER_UNIT: dict[str, float] = {
    "INR": 1,
    "USD": 84,
    "EUR": 90,
    "GBP": 107,
    "AED": 22.9,
    "SAR": 22.4,
    "QAR": 23.1,
    "SGD": 63,
    "MYR": 18.8,
    "THB": 2.45,
    "IDR": 0.0053,
    "JPY": 0.56,
    "CNY": 11.6,
    "HKD": 10.8,
    "AUD": 55,
    "NZD": 50,
    "CAD": 60,
    "CHF": 95,
    "ZAR": 4.6,
    "NPR": 0.625,
    "LKR": 0.28,
}

SYMBOLS: dict[str, str] = {
    "INR": "₹",
    "USD": "$",
    "EUR": "€",
    "GBP": "£",
    "JPY": "¥",
}

COUNTRY_CURRENCY: dict[str, CurrencyCode] = {
    "IN": "INR",
    "US": "USD",
    "GB": "GBP",
    "UK": "GBP",
    "AE": "AED",
    "SA": "SAR",
    "QA": "QAR",
    "SG": "SGD",
    "MY": "MYR",
    "TH": "THB",
    "ID": "IDR",
    "JP": "JPY",
    "CN": "CNY",
    "HK": "HKD",
    "AU": "AUD",
    "NZ": "NZD",
    "CA": "CAD",
    "CH": "CHF",
    "ZA": "ZAR",
    "NP": "NPR",
    "LK": "LKR",
    "DE": "EUR",
    "FR": "EUR",
    "IT": "EUR",
    "ES": "EUR",
    "NL": "EUR",
    "BE": "EUR",
    "AT": "EUR",
    "PT": "EUR",
    "IE": "EUR",
    "FI": "EUR",
    "GR": "EUR",
    "LU": "EUR",
}


def trip_currency(
    stated: str | None, origin_country: str | None
) -> tuple[CurrencyCode, str | None]:
    """Pick the Trip currency: stated supported code, else origin country's currency, else INR."""
    if stated and stated.strip():
        code = stated.strip().upper()
        if code in INR_PER_UNIT:
            return code, None  # type: ignore[return-value]
        return "USD", (
            f"I can't plan in {code} yet, so I ignored that budget and assumed one in US dollars. "
            "Give me a budget in USD, EUR, GBP or another supported currency to set it."
        )
    if origin_country and origin_country.strip():
        country_code = COUNTRY_CURRENCY.get(origin_country.strip().upper())
        if country_code:
            return country_code, None
    return "INR", None


def from_inr(amount: float, currency: str) -> int:
    return round(amount / INR_PER_UNIT[currency])


def format_money(amount: float, currency: str) -> str:
    prefix = SYMBOLS.get(currency, f"{currency} ")
    return f"{prefix}{amount:,.0f}"
