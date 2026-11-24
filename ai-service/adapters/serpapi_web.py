from adapters.serpapi_client import SerpApiClient, SerpApiError
from ports.web_search import WebResult, WebSearchError

MAX_RESULTS = 5


class SerpApiWebSearch:
    """Web search Provider: SerpAPI's Google results, read for fares like Tavily's."""

    def __init__(self, client: SerpApiClient):
        self._client = client

    def search(self, query: str) -> list[WebResult]:
        try:
            payload = self._client.get(
                {"engine": "google", "q": query, "gl": "in", "hl": "en"}, feature="web"
            )
        except SerpApiError as error:
            raise WebSearchError(str(error)) from error
        results = [
            WebResult(title=item.get("title", ""), url=item["link"], content=item["snippet"])
            for item in payload.get("organic_results") or []
            if item.get("link") and item.get("snippet")
        ]
        return results[:MAX_RESULTS]
