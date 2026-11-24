import httpx
import pytest
import respx

from adapters.tavily import TAVILY_URL, TavilyWebSearch
from ports.web_search import WebResult, WebSearchError

PAYLOAD = {
    "results": [
        {
            "title": "AMD to GOI flights",
            "url": "https://fares.example/amd-goi",
            "content": "Round trip from ₹6,400 in December",
        },
        {"title": "No content", "url": "https://fares.example/empty"},
    ]
}


@respx.mock
def test_results_with_content_are_returned():
    route = respx.post(TAVILY_URL).mock(return_value=httpx.Response(200, json=PAYLOAD))

    results = TavilyWebSearch(api_key="tvly-test").search("AMD to GOI fares")

    assert results == [
        WebResult(
            title="AMD to GOI flights",
            url="https://fares.example/amd-goi",
            content="Round trip from ₹6,400 in December",
        )
    ]
    assert route.calls[0].request.headers["Authorization"] == "Bearer tvly-test"


@respx.mock
def test_provider_error_becomes_web_search_error():
    respx.post(TAVILY_URL).mock(return_value=httpx.Response(429, json={"detail": "quota"}))

    with pytest.raises(WebSearchError):
        TavilyWebSearch(api_key="tvly-test").search("AMD to GOI fares")
