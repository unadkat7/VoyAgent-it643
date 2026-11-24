import httpx

from ports.web_search import WebResult, WebSearchError

TAVILY_URL = "https://api.tavily.com/search"
MAX_RESULTS = 5


class TavilyWebSearch:
    """Web search Provider: Tavily. Used to ground estimated fares in real, dated web prices."""

    def __init__(self, *, api_key: str, timeout_seconds: float = 20.0):
        self._api_key = api_key
        self._timeout = timeout_seconds

    def search(self, query: str) -> list[WebResult]:
        try:
            response = httpx.post(
                TAVILY_URL,
                json={"query": query, "max_results": MAX_RESULTS, "search_depth": "basic"},
                headers={"Authorization": f"Bearer {self._api_key}"},
                timeout=self._timeout,
            )
            response.raise_for_status()
            payload = response.json()
        except (httpx.HTTPError, ValueError) as error:
            raise WebSearchError(f"Tavily search failed: {error}") from error
        return [
            WebResult(title=item.get("title", ""), url=item["url"], content=item["content"])
            for item in payload.get("results") or []
            if item.get("url") and item.get("content")
        ]
