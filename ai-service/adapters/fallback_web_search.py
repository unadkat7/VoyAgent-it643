import logging

from ports.web_search import WebResult, WebSearchError, WebSearchPort

logger = logging.getLogger(__name__)


class FallbackWebSearch:
    """Use the primary web search; only if it fails, ask the fallback. No results is an answer."""

    def __init__(self, primary: WebSearchPort, fallback: WebSearchPort):
        self._primary = primary
        self._fallback = fallback

    def search(self, query: str) -> list[WebResult]:
        try:
            return self._primary.search(query)
        except WebSearchError as error:
            logger.warning("Web search failed, using the fallback: %s", error)
            return self._fallback.search(query)
