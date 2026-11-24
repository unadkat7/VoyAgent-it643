import logging
import math
import re
import threading
import time
from collections.abc import Callable
from typing import Any, Literal

import httpx

SERPAPI_URL = "https://serpapi.com/search.json"
ACCOUNT_URL = "https://serpapi.com/account.json"
REFRESH_SECONDS = 600.0
SPARE_SEARCHES = 2
API_KEY_PARAM = re.compile(r"(api_key=)[^&\s\"']+")

Feature = Literal["search", "web", "places"]
# Share of the monthly plan each feature must leave unused, so extras never starve live prices.
FLOOR_SHARES: dict[Feature, float] = {"search": 0.0, "web": 0.25, "places": 0.5}


class _RedactKey(logging.Filter):
    """httpx logs every request URL; SerpAPI only takes its key in the URL, so hide it."""

    def filter(self, record: logging.LogRecord) -> bool:
        message = record.getMessage()
        if "api_key=" in message:
            record.msg, record.args = API_KEY_PARAM.sub(r"\1REDACTED", message), ()
        return True


logging.getLogger("httpx").addFilter(_RedactKey())


class SerpApiError(Exception):
    """A SerpAPI call failed or was refused to stay inside the monthly plan."""


class SerpApiClient:
    """Shared SerpAPI caller that never spends past the free plan.

    The allowance comes from the Account API (free to call), so it survives restarts. Between
    refreshes each search is counted locally. If the allowance can't be read, nothing is spent.
    """

    def __init__(
        self,
        *,
        api_key: str,
        timeout_seconds: float = 45.0,
        clock: Callable[[], float] = time.monotonic,
    ):
        self._api_key = api_key
        self._timeout = timeout_seconds
        self._clock = clock
        self._lock = threading.Lock()
        self._plan_size = 0
        self._left = 0
        self._refreshed_at = float("-inf")

    def get(self, params: dict[str, Any], *, feature: Feature) -> dict[str, Any]:
        self._reserve(feature)
        try:
            response = httpx.get(
                SERPAPI_URL,
                params={**params, "api_key": self._api_key},
                timeout=self._timeout,
            )
            response.raise_for_status()
            return response.json()
        except (httpx.HTTPError, ValueError) as error:
            engine = params.get("engine")
            raise SerpApiError(f"SerpAPI {engine} failed: {_describe(error)}") from None

    def _reserve(self, feature: Feature) -> None:
        with self._lock:
            if self._clock() - self._refreshed_at >= REFRESH_SECONDS:
                self._refresh()
            floor = math.ceil(self._plan_size * FLOOR_SHARES[feature]) + SPARE_SEARCHES
            if self._left - 1 < floor:
                raise SerpApiError(
                    f"SerpAPI {feature} paused: {self._left} searches left this month"
                )
            self._left -= 1

    def _refresh(self) -> None:
        try:
            response = httpx.get(
                ACCOUNT_URL, params={"api_key": self._api_key}, timeout=self._timeout
            )
            response.raise_for_status()
            account = response.json()
            plan_size = int(account["searches_per_month"])
            left = int(account["total_searches_left"])
        except (httpx.HTTPError, ValueError, KeyError, TypeError) as error:
            raise SerpApiError(
                f"SerpAPI allowance unknown, not searching: {_describe(error)}"
            ) from None
        self._plan_size, self._left = plan_size, left
        self._refreshed_at = self._clock()


def _describe(error: Exception) -> str:
    # httpx messages include the request URL, which carries the key, so never echo them.
    if isinstance(error, httpx.HTTPStatusError):
        return f"HTTP {error.response.status_code}"
    return type(error).__name__
